import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Settings, User, Dumbbell, Apple, Sparkles, Info, KeyRound, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

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
    title: 'Calendar',
    description: 'Day schedule, temperature unit',
    href: '/settings/calendar',
    icon: CalendarDays,
  },
  {
    title: 'AI Coach',
    description: "Today's Suggestions panel, nutrition-aware recommendations",
    href: '/settings/ai-coach',
    icon: Sparkles,
  },
  {
    title: 'About',
    description: 'App name and version',
    href: '/settings/about',
    icon: Info,
  },
]

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isOwner = false
  if (user) {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    isOwner = roleRow?.role === 'owner'
  }

  const sections = isOwner
    ? [
        ...SECTIONS,
        {
          title: 'Invite Code',
          description: 'View and rotate the signup invite code',
          href: '/owner/invite-code',
          icon: KeyRound,
        },
      ]
    : SECTIONS

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <Settings className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Settings</h1>
            <p className="text-lapis-text-tertiary text-sm">Customize your experience</p>
          </div>
        </div>

        <div className="grid gap-3 max-w-2xl">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <Link key={section.href} href={section.href} className="block">
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lapis-md bg-lapis-surface-2">
                        <Icon className="w-5 h-5 text-lapis-text-secondary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-medium text-lapis-text-primary mb-1">{section.title}</h2>
                        <p className="text-lapis-text-tertiary text-sm">{section.description}</p>
                      </div>
                    </div>
                    <div className="text-lapis-text-disabled">→</div>
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
