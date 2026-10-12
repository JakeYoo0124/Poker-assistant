export interface NavItem {
  to: string
  label: string
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/equity', label: '승률 계산', icon: '🎯' },
  { to: '/ranges', label: '레인지', icon: '🔢' },
  { to: '/sizing', label: '베팅 사이즈', icon: '💰' },
  { to: '/practice', label: '연습 게임', icon: '🎮' },
  { to: '/hands', label: '핸드 기록', icon: '📒' },
]
