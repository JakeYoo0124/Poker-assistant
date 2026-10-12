/**
 * 연습 게임 코치: 사람이 한 행동을 추천 행동과 비교해 피드백을 만든다.
 *
 * 프리플랍: 헤즈업 기준 레인지(상위 몇 %)와 비교 (기대값 계산 없음)
 * 포스트플랍
 *   - 베팅이 없을 때: 베팅 사이즈 엔진(postflopAdvice)으로 체크·각 사이즈의 기대값을 비교
 *   - 베팅을 받았을 때: AI의 예상 레인지 대비 에퀴티와 팟 오즈로 콜/폴드 기대값 비교
 * AI의 레인지는 AI의 프리플랍 행동으로만 추정한다 (플랍 이후 행동으로 좁히지 않음).
 */

import { analyzeDraws } from './board'
import type { Card } from './cards'
import { EXACT_LIMIT, MonteCarloEquity, calculateExact, exactWork, type Combo, type EquityRequest } from './equity'
import type { Action, Street } from './game'
import { comboPercentile, topCombos } from './handRank'
import { preflopAdvice } from './preflopSizing'
import { postflopAdvice, type SizeOption, type VillainStyle } from './sizing'
import type { PreflopSituation } from './bot'
import { pctText } from './text'

export interface CoachRequest {
  street: Street
  hole: Combo
  board: Card[]
  /** 내 행동 직전의 팟 전체 (이번 스트리트 베팅 포함) */
  pot: number
  toCall: number
  /** 이번 스트리트의 현재 최고 베팅 */
  currentBet: number
  canRaise: boolean
  /** 남은 스택 (내 것, 상대 것) */
  heroStack: number
  villainStack: number
  /** 프리플랍 상황 (프리플랍일 때만) */
  situation: PreflopSituation | null
  inPosition: boolean
  /** AI 레인지 폭 추정치 (상위 몇 %) */
  villainPct: number
  villainStyle: VillainStyle
  action: Action
}

export type Verdict = 'good' | 'ok' | 'mistake'

export interface CoachFeedback {
  verdict: Verdict
  recommended: string
  chosen: string
  /** 추천 대비 기대값 손실 (BB). 계산하지 않았으면 null */
  evLoss: number | null
  notes: string[]
}

/** 헤즈업 기준 레인지 (상위 몇 %) */
export const HU_BASELINE = {
  open: 0.8,
  isoRaise: 0.3,
  threeBet: 0.15,
  defend: 0.65,
  fourBet: 0.06,
  call3bet: 0.25,
  vs4bet: 0.05,
}

type Kind = 'fold' | 'check' | 'call' | 'raise'

const KIND_LABELS: Record<Kind, string> = { fold: '폴드', check: '체크', call: '콜', raise: '레이즈' }

function describe(action: Action, currentBet: number): string {
  if (action.type === 'raise') return `${currentBet === 0 ? '베팅' : '레이즈'} ${action.to} BB`
  return KIND_LABELS[action.type]
}

function preflopFeedback(req: CoachRequest): CoachFeedback {
  const q = comboPercentile(req.hole)
  const sit = req.situation!
  const b = HU_BASELINE
  const stack = req.heroStack + (req.currentBet - req.toCall)

  // 상황별 [레이즈 기준, 계속(콜) 기준]
  let raiseMax: number
  let continueMax: number
  let raiseTo: number
  if (sit === 'first') {
    raiseMax = b.open
    continueMax = b.open
    raiseTo = preflopAdvice({ kind: 'open', position: 'BTN', limpers: 0, style: 'online', stack }).amount
  } else if (sit === 'vsLimp') {
    raiseMax = b.isoRaise
    continueMax = 1
    raiseTo = 4
  } else if (sit === 'vsOpen') {
    raiseMax = b.threeBet
    continueMax = b.defend * Math.min(1.2, Math.max(0.5, 2.5 / req.currentBet))
    raiseTo = preflopAdvice({ kind: '3bet', openSize: req.currentBet, inPosition: req.inPosition, callers: 0, stack }).amount
  } else if (sit === 'vs3bet') {
    raiseMax = b.fourBet
    continueMax = b.call3bet
    raiseTo = preflopAdvice({ kind: '4bet', threeBetSize: req.currentBet, inPosition: req.inPosition, stack }).amount
  } else {
    raiseMax = b.vs4bet / 2
    continueMax = b.vs4bet
    raiseTo = stack
  }

  const passiveKind: Kind = req.toCall === 0 ? 'check' : 'fold'
  const continueKind: Kind = req.toCall === 0 ? 'check' : 'call'
  const recommendedKind: Kind = q <= raiseMax && req.canRaise ? 'raise' : q <= continueMax ? continueKind : passiveKind
  const chosenKind: Kind = req.action.type

  const recommended = recommendedKind === 'raise' ? `레이즈 ${Math.min(raiseTo, stack)} BB` : KIND_LABELS[recommendedKind]
  const notes = [`내 핸드는 상위 ${pctText(q)} 수준입니다. 헤즈업 기준: 레이즈는 상위 ${pctText(raiseMax)}, 계속은 상위 ${pctText(Math.min(1, continueMax))}까지.`]

  // 기준선 근처(±5%)면 어느 쪽도 큰 실수가 아니다
  const nearLine = Math.abs(q - raiseMax) < 0.05 || Math.abs(q - continueMax) < 0.05
  let verdict: Verdict = chosenKind === recommendedKind ? 'good' : nearLine ? 'ok' : 'mistake'
  // 체크 가능한데 폴드는 없다 (게임에서 막혀 있음), 레이즈 대신 콜 같은 차이는 '괜찮음'으로 완화
  if (verdict === 'mistake' && recommendedKind === 'raise' && chosenKind === continueKind) verdict = 'ok'

  if (chosenKind === 'raise' && recommendedKind === 'raise' && req.action.type === 'raise') {
    const ratio = req.action.to / raiseTo
    if (ratio < 0.7 || ratio > 1.4) notes.push(`사이즈는 ${raiseTo} BB 정도가 표준입니다.`)
  }
  return { verdict, recommended, chosen: describe(req.action, req.currentBet), evLoss: null, notes }
}

function equityVs(hole: Combo, board: Card[], villain: Combo[]): number {
  const req: EquityRequest = {
    players: [
      { kind: 'combos', combos: [hole] },
      { kind: 'combos', combos: villain },
    ],
    board,
  }
  if (exactWork(req) <= EXACT_LIMIT) return calculateExact(req).players[0].equity
  const mc = new MonteCarloEquity(req)
  mc.run(30_000)
  return mc.result().players[0].equity
}

function verdictByLoss(loss: number, pot: number): Verdict {
  if (loss <= Math.max(0.1, pot * 0.03)) return 'good'
  if (loss <= pot * 0.15) return 'ok'
  return 'mistake'
}

function postflopFeedback(req: CoachRequest): CoachFeedback {
  const villain = topCombos(req.villainPct, [...req.hole, ...req.board])
  const draws = analyzeDraws(req.hole, req.board).labels
  const notes: string[] = [`AI의 예상 레인지: 프리플랍 행동 기준 상위 ${pctText(req.villainPct)} (${villain.length}콤보).`]
  if (draws.length) notes.push(`내 드로우: ${draws.join(', ')}.`)

  if (req.toCall === 0) {
    const advice = postflopAdvice({
      hero: req.hole,
      board: req.board,
      pot: req.pot,
      stack: Math.min(req.heroStack, req.villainStack),
      villain,
      style: req.villainStyle,
    })
    const label = (o: SizeOption) =>
      o.kind === 'check' ? '체크' : `${o.kind === 'allin' ? '올인' : '베팅'} ${o.bet} BB (팟의 ${Math.round(o.fraction * 100)}%)`
    let chosen = advice.options[0]
    if (req.action.type === 'raise') {
      const to = req.action.to
      chosen = advice.options
        .filter((o) => o.kind !== 'check')
        .reduce((a, o) => (Math.abs(o.bet - to) < Math.abs(a.bet - to) ? o : a))
    }
    const loss = Math.max(0, advice.best.ev - chosen.ev)
    notes.unshift(`AI 레인지 대비 내 승률 ${pctText(advice.equity)}.`)
    if (req.action.type === 'raise' && Math.abs(chosen.bet - req.action.to) > 0.5) {
      notes.push(`내 베팅을 가장 가까운 후보(${label(chosen)})로 평가했습니다.`)
    }
    return {
      verdict: verdictByLoss(loss, req.pot),
      recommended: label(advice.best),
      chosen: describe(req.action, req.currentBet),
      evLoss: loss,
      notes,
    }
  }

  const eq = equityVs(req.hole, req.board, villain)
  const required = req.toCall / (req.pot + req.toCall)
  const callEv = eq * (req.pot + req.toCall) - req.toCall
  notes.unshift(`AI 레인지 대비 내 승률 ${pctText(eq)}, 콜에 필요한 승률 ${pctText(required)} (팟 오즈).`)

  let recommended: string
  if (eq >= 0.75 && req.canRaise) recommended = '레이즈 (밸류)'
  else recommended = callEv >= 0 ? '콜' : '폴드'

  let loss: number | null
  if (req.action.type === 'fold') loss = Math.max(0, callEv)
  else if (req.action.type === 'call') loss = Math.max(0, -callEv)
  else {
    loss = eq >= 0.6 ? 0 : Math.max(0, -callEv)
    notes.push('레이즈의 기대값은 따로 계산하지 않고, 콜 기준으로 평가했습니다.')
  }
  notes.push(`콜의 기대값: ${callEv >= 0 ? '+' : ''}${callEv.toFixed(2)} BB (폴드 = 0).`)

  return {
    verdict: verdictByLoss(loss, req.pot),
    recommended,
    chosen: describe(req.action, req.currentBet),
    evLoss: loss,
    notes,
  }
}

export function coachDecision(req: CoachRequest): CoachFeedback {
  return req.street === 'preflop' ? preflopFeedback(req) : postflopFeedback(req)
}
