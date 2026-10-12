import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS } from './nav'

const SUITS = '♠♥♦♣'

export default function Layout() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* 데스크톱: 왼쪽 사이드바 */}
      <aside className="hidden w-56 shrink-0 flex-col bg-felt-800 text-felt-50 md:flex">
        <div className="px-5 py-6">
          <p className="text-lg font-bold">포커 어시스턴트</p>
          <p className="mt-1 text-sm tracking-widest text-felt-100/70">{SUITS}</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-felt-600 text-white' : 'text-felt-100 hover:bg-felt-700'
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 모바일: 상단 헤더 */}
      <header className="flex items-center justify-between bg-felt-800 px-4 py-3 text-felt-50 md:hidden">
        <p className="font-bold">포커 어시스턴트</p>
        <p className="text-sm tracking-widest text-felt-100/70">{SUITS}</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-6">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* 모바일: 하단 탭바 */}
      <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'font-semibold text-felt-600' : 'text-slate-500'
              }`
            }
          >
            <span aria-hidden className="text-lg">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
