import { useRef, type PointerEvent } from 'react'
import { ALL_CLASSES, type HandClass } from '../../core/range'
import { ACTION_CELL_CLASSES, ACTION_LABELS, type RangeAction, type RangeChart } from './model'

interface RangeGridProps {
  cells: RangeChart['cells']
  /** 칠할 액션 */
  brush: RangeAction
  /** action이 null이면 폴드로 지운다 */
  onPaint: (classes: HandClass[], action: RangeAction | null) => void
}

const classFromPoint = (x: number, y: number): HandClass | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-cls]')
  return el?.dataset.cls ?? null
}

/**
 * 13×13 레인지 그리드. 클릭하거나 드래그해서 칠한다.
 * 이미 붓과 같은 액션인 칸에서 시작하면 그 드래그는 지우기가 된다.
 * 마우스와 터치 모두 지원하도록 포인터 캡처 + elementFromPoint를 쓴다.
 */
export default function RangeGrid({ cells, brush, onPaint }: RangeGridProps) {
  const drag = useRef<{ action: RangeAction | null; seen: Set<HandClass>; x: number; y: number } | null>(null)

  const handleDown = (e: PointerEvent<HTMLDivElement>) => {
    const cls = classFromPoint(e.clientX, e.clientY)
    if (!cls) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 캡처할 수 없는 포인터(합성 이벤트 등)여도 칠하기는 계속한다
    }
    const action = cells[cls] === brush ? null : brush
    drag.current = { action, seen: new Set([cls]), x: e.clientX, y: e.clientY }
    onPaint([cls], action)
  }

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    // 포인터가 빠르게 움직이면 이벤트 사이의 칸을 건너뛰므로, 직전 위치부터 선을 따라 샘플링한다
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4))
    const added: HandClass[] = []
    for (let i = 1; i <= steps; i++) {
      const cls = classFromPoint(d.x + (dx * i) / steps, d.y + (dy * i) / steps)
      if (cls && !d.seen.has(cls)) {
        d.seen.add(cls)
        added.push(cls)
      }
    }
    d.x = e.clientX
    d.y = e.clientY
    if (added.length) onPaint(added, d.action)
  }

  const handleEnd = () => {
    drag.current = null
  }

  return (
    <div
      className="grid touch-none select-none grid-cols-13 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-700"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
      role="grid"
      aria-label="레인지 차트"
    >
      {ALL_CLASSES.map((cls) => {
        const action = cells[cls]
        const isPair = cls.length === 2
        const face = action
          ? ACTION_CELL_CLASSES[action]
          : isPair
            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            : 'bg-white text-slate-400 dark:bg-slate-900 dark:text-slate-500'
        return (
          <button
            key={cls}
            type="button"
            data-cls={cls}
            aria-label={`${cls} ${action ? ACTION_LABELS[action] : '폴드'}`}
            // 키보드(Enter/Space)로 누를 때만 처리. 마우스·터치는 그리드의 포인터 이벤트가 처리한다.
            onClick={(e) => {
              if (e.detail === 0) onPaint([cls], action === brush ? null : brush)
            }}
            className={`flex aspect-square items-center justify-center text-[9px] font-semibold tracking-tighter sm:text-xs ${face}`}
          >
            {cls}
          </button>
        )
      })}
    </div>
  )
}
