import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconSun, IconMoon } from './icons'

export default function DarkModeToggle({ compact = false }: { compact?: boolean }): React.ReactElement {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check localStorage and system preference
    const savedTheme = localStorage.getItem('theme')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = (): void => {
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }

  return (
    <Button
      variant="outline"
      size={compact ? 'iconSm' : 'icon'}
      onClick={toggleDarkMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark
        ? <IconMoon aria-hidden="true" className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        : <IconSun aria-hidden="true" className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </Button>
  )
}
