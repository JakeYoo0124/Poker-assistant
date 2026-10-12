import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseRange, type HandClass } from '../../core/range'
import { defaultCharts, newId, type RangeAction, type RangeChart } from './model'

interface RangesState {
  charts: RangeChart[]
  selectedId: string | null

  select: (id: string) => void
  create: (name: string) => void
  duplicate: (id: string) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  /** action이 null이면 폴드(지우기) */
  paint: (id: string, classes: HandClass[], action: RangeAction | null) => void
  /** 텍스트 표기를 해당 액션으로 칠한다. 표기가 잘못되면 오류를 던진다. */
  paintText: (id: string, text: string, action: RangeAction | null) => void
  clear: (id: string) => void
  /** 지운 기본 레인지를 이름 기준으로 다시 추가한다 */
  restoreDefaults: () => void
}

const updateChart = (charts: RangeChart[], id: string, fn: (c: RangeChart) => RangeChart) =>
  charts.map((c) => (c.id === id ? fn(c) : c))

const initialCharts = defaultCharts()

export const useRangesStore = create<RangesState>()(
  persist(
    (set, get) => ({
      charts: initialCharts,
      selectedId: initialCharts[0]?.id ?? null,

      select: (id) => set({ selectedId: id }),

      create: (name) => {
        const chart: RangeChart = { id: newId(), name, cells: {} }
        set({ charts: [...get().charts, chart], selectedId: chart.id })
      },

      duplicate: (id) => {
        const src = get().charts.find((c) => c.id === id)
        if (!src) return
        const copy: RangeChart = { id: newId(), name: `${src.name} 복사본`, cells: { ...src.cells } }
        set({ charts: [...get().charts, copy], selectedId: copy.id })
      },

      rename: (id, name) => set({ charts: updateChart(get().charts, id, (c) => ({ ...c, name })) }),

      remove: (id) => {
        const charts = get().charts.filter((c) => c.id !== id)
        const selectedId = get().selectedId === id ? (charts[0]?.id ?? null) : get().selectedId
        set({ charts, selectedId })
      },

      paint: (id, classes, action) =>
        set({
          charts: updateChart(get().charts, id, (c) => {
            const cells = { ...c.cells }
            for (const cls of classes) {
              if (action) cells[cls] = action
              else delete cells[cls]
            }
            return { ...c, cells }
          }),
        }),

      paintText: (id, text, action) => {
        const classes = [...parseRange(text)]
        get().paint(id, classes, action)
      },

      clear: (id) => set({ charts: updateChart(get().charts, id, (c) => ({ ...c, cells: {} })) }),

      restoreDefaults: () => {
        const names = new Set(get().charts.map((c) => c.name))
        const missing = defaultCharts().filter((c) => !names.has(c.name))
        if (missing.length) set({ charts: [...get().charts, ...missing] })
      },
    }),
    { name: 'poker-assistant:ranges', version: 1 },
  ),
)
