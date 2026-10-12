import { ALL_CLASSES, parseRange, type HandClass } from '../../core/range'

export type RangeAction = 'raise' | 'call' | 'allin'

export const RANGE_ACTIONS: readonly RangeAction[] = ['raise', 'call', 'allin']

export const ACTION_LABELS: Record<RangeAction, string> = {
  raise: '레이즈',
  call: '콜',
  allin: '올인',
}

/** 칸 배경색 (그리드, 범례 공용) */
export const ACTION_CELL_CLASSES: Record<RangeAction, string> = {
  raise: 'bg-rose-500 text-white',
  call: 'bg-emerald-500 text-white',
  allin: 'bg-violet-600 text-white',
}

export interface RangeChart {
  id: string
  name: string
  /** 표시되지 않은 핸드는 폴드 */
  cells: Partial<Record<HandClass, RangeAction>>
}

/** 폴드가 아닌 핸드 (승률 계산기에서 상대 레인지로 쓸 때) */
export function playableClasses(chart: RangeChart): HandClass[] {
  return ALL_CLASSES.filter((cls) => chart.cells[cls] !== undefined)
}

export function classesWith(chart: RangeChart, action: RangeAction): HandClass[] {
  return ALL_CLASSES.filter((cls) => chart.cells[cls] === action)
}

/**
 * 기본 제공 레인지: 6-max 캐시게임, 유효 스택 100BB, 앞에서 모두 폴드했을 때의 오픈(레이즈) 레인지.
 * 널리 쓰이는 값을 단순화한 참고용이며, 솔버 결과와 정확히 같지는 않다.
 */
export const DEFAULT_RANGES: readonly { name: string; raise: string }[] = [
  { name: 'UTG 오픈', raise: '66+, A3s+, K9s+, QTs+, JTs, T9s, 98s, AJo+, KQo' },
  { name: 'HJ 오픈', raise: '55+, A2s+, K8s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo' },
  {
    name: 'CO 오픈',
    raise: '33+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
  },
  {
    name: 'BTN 오픈',
    raise:
      '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T8o+, 98o, 87o',
  },
  {
    name: 'SB 오픈',
    raise: '22+, A2s+, K3s+, Q5s+, J7s+, T7s+, 97s+, 86s+, 75s+, 65s, 54s, A4o+, K9o+, Q9o+, J9o+, T9o',
  },
]

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function defaultCharts(): RangeChart[] {
  return DEFAULT_RANGES.map(({ name, raise }) => {
    const cells: RangeChart['cells'] = {}
    for (const cls of parseRange(raise)) cells[cls] = 'raise'
    return { id: newId(), name, cells }
  })
}
