import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Settings, User, Dumbbell, Apple, Bell, Info } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Account',
    description: 'Display name and email',
    href: '/settings/account',
    icon: User,
  },
  {
    title: 'Training',
    description: 'Weekly target, weight unit, goal weight, training phase',
    href: '/settings/training',
    icon: Dumbbell,
  },
  {
    title: 'Nutrition',
    description: 'Maintenance calories',
    href: '/settings/nutrition',
    icon: Apple,
  },
  {
    title: 'Notifications',
    description: "Today's Suggestions panel",
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    title: 'About',
    description: 'App name and version',
    href: '/settings/about',
    icon: Info,
  },
]

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Settings className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Settings</h1>
            <p className="text-white/50 text-sm">Customize your experience</p>
          </div>
        </div>

        <div className="grid gap-3 max-w-2xl">
          {SECTIONS.map((section) => {
            const Icon = section.icon
            return (
              <Link key={section.href} href={section.href} className="block">
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-white/5">
                        <Icon className="w-5 h-5 text-white/60" />
                      </div>
                      <div>
                        <h2 className="text-lg font-medium text-white mb-1">{section.title}</h2>
                        <p className="text-white/40 text-sm">{section.description}</p>
                      </div>
                    </div>
                    <div className="text-white/30">→</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
