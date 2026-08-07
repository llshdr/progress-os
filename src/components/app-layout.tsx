'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sun,
  Dumbbell,
  Apple,
  Target,
  CalendarDays,
  Settings,
} from 'lucide-react'

const navItems = [
  { name: 'Today', href: '/dashboard', icon: Sun },
  { name: 'Gym', href: '/gym', icon: Dumbbell },
  { name: 'Nutrition', href: '/nutrition', icon: Apple },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-lapis-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-lapis-border-subtle bg-lapis-surface-1/60 backdrop-blur-xl">
        <div className="p-6">
          <h1 className="font-display italic text-xl font-medium tracking-tight text-lapis-text-primary">
            L·A·<span className="not-italic font-semibold text-lapis-gold-500">P</span>·I·S
          </h1>
        </div>

        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lapis-sm text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-lapis-accent-500/15 text-lapis-text-primary'
                        : 'text-lapis-text-secondary hover:text-lapis-text-primary hover:bg-lapis-surface-2'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-lapis-accent-400' : ''}`} />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation - active state reuses the exact same
          bg-lapis-accent-500/15 chip the desktop sidebar uses for its
          active row, so both surfaces say "you are here" with the same
          visual grammar instead of two different conventions. Extra
          bottom padding accounts for the iOS home-indicator safe area -
          without it, the bar sits flush against (or under) the gesture
          bar on notched iPhones. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-lapis-border-subtle bg-lapis-surface-1/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <ul className="flex items-center justify-around py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lapis-sm transition-colors ${
                    isActive
                      ? 'bg-lapis-accent-500/15 text-lapis-text-primary'
                      : 'text-lapis-text-tertiary hover:text-lapis-text-secondary'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-lapis-accent-400' : ''}`} />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
