/**
 * 연습 게임용 규칙 기반 AI 상대 (헤즈업)
 *
 * 프리플랍: 핸드 순위(상위 몇 %)를 성향별 기준과 비교해 레이즈·콜·폴드
 * 포스트플랍: 상대의 예상 레인지를 상대로 내 에퀴티를 몬테카를로로 추정하고,
 *            밸류 베팅 기준·블러프 빈도·팟 오즈로 판단
 */

import { analyzeDraws } from './board'
import { preflopAdvice } from './preflopSizing'
import type { VillainStyle } from './sizing'
import {
  BIG_BLIND,
  chips,
  currentBet,
  legalActions,
  totalPot,
  type Action,
  type ActionRecord,
  type HandState,
  type PlayerId,
} from './game'
import { comboPercentile, sampleEquity, topCombos } from './handRank'

export type BotProfileId = 'tag' | 'lag' | 'station' | 'nit'

export interface BotProfile {
  id: BotProfileId
  name: string
  description: string
  /** 프리플랍 기준: 상위 몇 % 핸드까지 (0~1) */
  open: number
  isoRaise: number
  defend: number
  threeBet: number
  fourBet: number
  call3bet: number
  post: {
    /** 이 에퀴티 이상이면 밸류 베팅 */
    valueEq: number
    /** 블러프·세미블러프 빈도 */
    bluff: number
    /** 콜 기준 = 필요 에퀴티 + callMargin (음수면 더 많이 콜) */
    callMargin: number
    /** 이 에퀴티 이상이면 레이즈 */
    raiseEq: number
    /** 팟 대비 베팅 크기 */
    betFraction: number
  }
  /** 코치가 베팅 사이즈를 계산할 때 쓰는 상대 성향 */
  coachStyle: VillainStyle
}

export const BOT_PROFILES: Record<BotProfileId, BotProfile> = {
  tag: {
    id: 'tag',
    name: '정석형 (타이트-공격적)',
    description: '좋은 핸드만 골라 적극적으로 베팅합니다. 가장 무난한 연습 상대.',
    open: 0.6,
    isoRaise: 0.3,
    defend: 0.55,
    threeBet: 0.12,
    fourBet: 0.04,
    call3bet: 0.15,
    post: { valueEq: 0.62, bluff: 0.25, callMargin: 0.03, raiseEq: 0.82, betFraction: 0.66 },
    coachStyle: 'balanced',
  },
  lag: {
    id: 'lag',
    name: '루즈-공격적',
    description: '많은 핸드로 참여하고 블러프가 잦습니다. 콜 판단을 연습하기 좋아요.',
    open: 0.85,
    isoRaise: 0.45,
    defend: 0.7,
    threeBet: 0.22,
    fourBet: 0.07,
    call3bet: 0.3,
    post: { valueEq: 0.55, bluff: 0.45, callMargin: -0.03, raiseEq: 0.75, betFraction: 0.75 },
    coachStyle: 'balanced',
  },
  station: {
    id: 'station',
    name: '콜링 스테이션',
    description: '웬만하면 콜하고 블러프는 거의 안 합니다. 밸류 베팅을 연습하기 좋아요.',
    open: 0.7,
    isoRaise: 0.15,
    defend: 0.9,
    threeBet: 0.05,
    fourBet: 0.02,
    call3bet: 0.6,
    post: { valueEq: 0.7, bluff: 0.05, callMargin: -0.15, raiseEq: 0.9, betFraction: 0.5 },
    coachStyle: 'station',
  },
  nit: {
    id: 'nit',
    name: '니트 (매우 타이트)',
    description: '아주 강한 핸드로만 플레이하고 쉽게 폴드합니다. 블러프를 연습하기 좋아요.',
    open: 0.35,
    isoRaise: 0.12,
    defend: 0.35,
    threeBet: 0.06,
    fourBet: 0.03,
    call3bet: 0.08,
    post: { valueEq: 0.7, bluff: 0.08, callMargin: 0.08, raiseEq: 0.88, betFraction: 0.5 },
    coachStyle: 'tight',
  },
}

/** 상대(사람)의 레인지를 추정할 때 쓰는 기본 기준 */
export const STANDARD_PROFILE = BOT_PROFILES.tag

export type PreflopSituation = 'first' | 'vsLimp' | 'vsOpen' | 'vs3bet' | 'vs4bet'

export const SITUATION_LABELS: Record<PreflopSituation, string> = {
  first: '먼저 행동 (SB/버튼)',
  vsLimp: '상대가 림프(콜)',
  vsOpen: '상대가 오픈 레이즈',
  vs3bet: '상대가 3벳',
  vs4bet: '상대가 4벳 이상',
}

function situationFrom(raisesBefore: number, isButton: boolean, isFirstAction: boolean): PreflopSituation {
  if (raisesBefore === 0) return isButton && isFirstAction ? 'first' : 'vsLimp'
  if (raisesBefore === 1) return 'vsOpen'
  if (raisesBefore === 2) return 'vs3bet'
  return 'vs4bet'
}

/** 지금 player가 프리플랍에서 마주한 상황 */
export function preflopSituation(s: HandState, player: PlayerId): PreflopSituation {
  const pre = s.log.filter((r) => r.street === 'preflop')
  const raises = pre.filter((r) => r.type === 'raise' || r.type === 'bet').length
  const acted = pre.some((r) => r.player === player)
  return situationFrom(raises, player === s.button, !acted)
}

/**
 * 프리플랍 행동으로 player의 레인지 폭(상위 몇 %)을 추정한다.
 * profile은 그 플레이어가 따른다고 가정하는 기준.
 */
export function estimateRangePct(log: readonly ActionRecord[], player: PlayerId, button: PlayerId, profile: BotProfile): number {
  let raises = 0
  let pct = 1
  let actedBefore = false
  for (const r of log) {
    if (r.street !== 'preflop') break
    if (r.player === player) {
      const sit = situationFrom(raises, player === button, !actedBefore)
      actedBefore = true
      if (r.type === 'raise' || r.type === 'bet') {
        const p = { first: profile.open, vsLimp: profile.isoRaise, vsOpen: profile.threeBet, vs3bet: profile.fourBet, vs4bet: profile.fourBet / 2 }[sit]
        pct = Math.min(pct, p)
      } else if (r.type === 'call') {
        const p = { first: 0.9, vsLimp: 1, vsOpen: profile.defend, vs3bet: profile.call3bet, vs4bet: profile.fourBet }[sit]
        pct = Math.min(pct, p)
      }
    }
    if (r.type === 'raise' || r.type === 'bet') raises++
  }
  return pct
}

/** 레이즈 금액을 합법 범위로 맞추고, 스택 대부분이면 올인으로 바꾼다 */
function raiseTo(s: HandState, to: number): Action {
  const legal = legalActions(s)
  if (!legal.canRaise) return legal.canCheck ? { type: 'check' } : { type: 'call' }
  let amount = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, chips(Math.round(to * 2) / 2)))
  if (amount >= legal.maxRaiseTo * 0.6) amount = legal.maxRaiseTo
  return { type: 'raise', to: amount }
}

const passive = (s: HandState): Action => (legalActions(s).canCheck ? { type: 'check' } : { type: 'fold' })

function preflopDecision(s: HandState, me: PlayerId, profile: BotProfile, random: () => number): Action {
  const q = comboPercentile(s.holes[me]) + (random() - 0.5) * 0.06
  const sit = preflopSituation(s, me)
  const bet = currentBet(s)
  const stack = s.stacks[me] + s.committed[me]
  const inPosition = me !== s.button // 헤즈업에서 BB는 플랍 이후 나중에 행동한다

  switch (sit) {
    case 'first':
      if (q <= profile.open) return raiseTo(s, 2.5)
      if (profile.id === 'station' && q <= 0.9) return { type: 'call' }
      return { type: 'fold' }
    case 'vsLimp':
      return q <= profile.isoRaise ? raiseTo(s, 4) : { type: 'check' }
    case 'vsOpen': {
      const defend = profile.defend * Math.min(1.2, Math.max(0.5, 2.5 / bet))
      if (q <= profile.threeBet) {
        const a = preflopAdvice({ kind: '3bet', openSize: bet, inPosition, callers: 0, stack })
        return raiseTo(s, a.amount)
      }
      return q <= defend ? { type: 'call' } : passive(s)
    }
    case 'vs3bet':
      if (q <= profile.fourBet) {
        const a = preflopAdvice({ kind: '4bet', threeBetSize: bet, inPosition, stack })
        return raiseTo(s, a.amount)
      }
      return q <= profile.call3bet ? { type: 'call' } : passive(s)
    case 'vs4bet':
      if (q <= profile.fourBet / 2) return raiseTo(s, stack)
      return q <= profile.fourBet ? { type: 'call' } : passive(s)
  }
}

function postflopDecision(s: HandState, me: PlayerId, profile: BotProfile, random: () => number): Action {
  const opp: PlayerId = me === 0 ? 1 : 0
  const legal = legalActions(s)
  const hole = s.holes[me]
  const oppPct = estimateRangePct(s.log, opp, s.button, STANDARD_PROFILE)
  const oppCombos = topCombos(oppPct, [...hole, ...s.board])
  const equity = sampleEquity(hole, s.board, oppCombos, 400, random)
  const pot = totalPot(s)
  const { post } = profile

  if (legal.canCheck) {
    const draws = analyzeDraws(hole, s.board).labels.length > 0
    const bet = Math.max(BIG_BLIND, pot * post.betFraction)
    if (equity >= post.valueEq) return raiseTo(s, bet)
    if (draws && random() < post.bluff) return raiseTo(s, bet)
    if (equity < 0.3 && random() < post.bluff / 2) return raiseTo(s, bet)
    return { type: 'check' }
  }

  const toCall = legal.callAmount
  const required = toCall / (pot + toCall)
  if (equity >= post.raiseEq && legal.canRaise) return raiseTo(s, currentBet(s) * 3)
  if (equity >= required + post.callMargin) return { type: 'call' }
  return { type: 'fold' }
}

/** AI의 다음 행동 */
export function botDecision(s: HandState, me: PlayerId, profile: BotProfile, random: () => number = Math.random): Action {
  if (s.toAct !== me) throw new Error('AI의 차례가 아닙니다')
  return s.street === 'preflop' ? preflopDecision(s, me, profile, random) : postflopDecision(s, me, profile, random)
}
