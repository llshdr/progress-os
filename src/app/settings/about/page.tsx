import BackLink from '@/components/lapis/back-link'
import AppLayout from '@/components/app-layout'
import packageJson from '../../../../package.json'

export default function AboutSettingsPage() {
  return (
    <AppLayout>
      <div className="lapis-page">
        <BackLink fallback="/settings" className="mb-6" />

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-8">About</h1>

        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 max-w-md">
          <p className="text-lapis-text-primary font-medium">L.A.P.I.S</p>
          <p className="text-lapis-text-tertiary text-sm mt-1">Version {packageJson.version}</p>
        </div>
      </div>
    </AppLayout>
  )
}
