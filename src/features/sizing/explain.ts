import { WETNESS_LABELS } from '../../core/board'
import { HAND_STRENGTH_LABELS, type PostflopAdvice } from '../../core/sizing'
import { pct } from '../../components/format'

/** 추천 결과를 사람이 읽을 근거 문장으로 바꾼다 */
export function explainPostflop(a: PostflopAdvice): string[] {
  const lines: string[] = []

  lines.push(
    `상대 레인지(${a.combos}콤보) 전체를 상대로 내 승률은 ${pct(a.equity)}입니다 → ${HAND_STRENGTH_LABELS[a.strength]}.`,
  )
  if (a.draws.labels.length) lines.push(`내 드로우: ${a.draws.labels.join(', ')}.`)

  lines.push(`보드: ${WETNESS_LABELS[a.texture.wetness]} — ${a.texture.notes.join(', ')}.`)

  const spr = a.spr.toFixed(1)
  if (a.spr <= 3) lines.push(`SPR ${spr}: 스택이 팟에 비해 작아, 올인까지 염두에 둔 플레이가 자연스럽습니다.`)
  else if (a.spr <= 8) lines.push(`SPR ${spr}: 이번 베팅 크기에 따라 리버 올인 여부가 갈리는 깊이입니다.`)
  else lines.push(`SPR ${spr}: 스택이 깊어 큰 팟을 만들려면 매우 강한 핸드가 필요합니다.`)

  const b = a.best
  const check = a.options[0]
  if (b.kind === 'check') {
    lines.push(
      '체크가 기대값이 가장 높습니다. 베팅하면 내가 이기는 약한 핸드는 폴드하고 나를 이기는 핸드만 콜해서, 베팅할수록 손해가 됩니다.',
    )
  } else if (b.equityWhenCalled >= 0.5) {
    lines.push(
      `밸류 베팅: 콜당해도 승률이 ${pct(b.equityWhenCalled)}로 앞서므로 더 약한 핸드에게 돈을 받아냅니다 (체크보다 +${(b.ev - check.ev).toFixed(2)} BB).`,
    )
  } else {
    lines.push(
      `블러프·세미블러프: 콜당하면 승률이 ${pct(b.equityWhenCalled)}로 불리하지만, 상대가 ${pct(b.foldRate)} 폴드해서 팟을 가져오는 가치가 더 큽니다 (체크보다 +${(b.ev - check.ev).toFixed(2)} BB).`,
    )
  }
  return lines
}
