import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  actions?: ReactNode
  children: ReactNode
}

export default function Panel({ title, actions, children }: PanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}
