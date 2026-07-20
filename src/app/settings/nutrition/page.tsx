import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Apple } from 'lucide-react'

export default function NutritionSettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back to Settings
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Apple className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Nutrition</h1>
            <p className="text-white/50 text-sm">Calorie and macro tracking preferences</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/60">
            In Development
          </span>
        </div>

        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center max-w-md">
          <p className="text-white/40 text-sm">
            Nutrition settings will live here once kcal/macro tracking exists.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
