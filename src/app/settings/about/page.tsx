import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import packageJson from '../../../../package.json'

export default function AboutSettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">About</h1>

        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 max-w-md">
          <p className="text-lapis-text-primary font-medium">L.A.P.I.S</p>
          <p className="text-lapis-text-tertiary text-sm mt-1">Version {packageJson.version}</p>
        </div>
      </div>
    </AppLayout>
  )
}
