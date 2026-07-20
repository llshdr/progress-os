import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import packageJson from '../../../../package.json'

export default function AboutSettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-8">About</h1>

        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 max-w-md">
          <p className="text-white font-medium">L.A.P.I.S</p>
          <p className="text-white/40 text-sm mt-1">Version {packageJson.version}</p>
        </div>
      </div>
    </AppLayout>
  )
}
