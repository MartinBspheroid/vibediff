import { useEffect, useState } from 'react'
import { IconSun, IconMoon } from './icons'

export default function DarkModeToggle(): React.ReactElement {
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
    <button
      onClick={toggleDarkMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="inline-flex items-center justify-center px-3 py-1.5 text-sm text-[#586069] dark:text-[#8b949e] border border-[rgba(27,31,35,.15)] dark:border-[#30363d] rounded-md hover:bg-black/5 dark:hover:bg-gray-800 hover:text-[#24292e] dark:hover:text-[#c9d1d9] transition-colors cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0366d6] dark:focus-visible:ring-[#1f6feb] focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0d1117]"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark
        ? <IconMoon aria-hidden="true" className="w-4 h-4" />
        : <IconSun aria-hidden="true" className="w-4 h-4" />}
    </button>
  )
}
