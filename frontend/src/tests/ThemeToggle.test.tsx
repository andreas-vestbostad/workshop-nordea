import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ThemeToggle from '../components/ThemeToggle'

describe('ThemeToggle', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
  })

  afterEach(() => {
    store.clear()
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.theme
  })

  it('switches between light and dark and remembers the choice', () => {
    document.documentElement.dataset.theme = 'light'
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(store.get('theme')).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(store.get('theme')).toBe('light')
  })
})
