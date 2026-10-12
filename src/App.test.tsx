import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App 라우팅', () => {
  it('루트 경로는 승률 계산 페이지로 이동한다', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: '승률 계산' })).toBeInTheDocument()
  })

  it.each([
    ['/ranges', '프리플랍 레인지'],
    ['/sizing', '베팅 사이즈 추천'],
    ['/practice', '연습 게임'],
    ['/hands', '핸드 기록'],
  ])('%s 경로에서 "%s" 페이지를 보여준다', (path, title) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
