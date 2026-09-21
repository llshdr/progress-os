import AppLayout from "@/components/app-layout";
import { PageHeader, NavRow } from "@/components/lapis/page";
import TodaySuggestionsSection from "@/components/ai-coach/today-suggestions-section";
import { Settings2, Mountain, CalendarDays } from "lucide-react";
import Link from "next/link";
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
  const { context } = await searchParams
  const returnPath = context && /^\/(gym|goals|nutrition|plan|journey)(\/|$)/.test(context) && !context.includes('://') ? context : null
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Coach"
          subtitle="Useful next steps from your training and goals."
          action={
            <Link
              href="/settings/ai-coach"
              aria-label="Coach preferences"
              className="lapis-icon-button"
            >
              <Settings2 size={20} />
            </Link>
          }
        />
        {returnPath && <Link href={returnPath} className="lapis-secondary mb-6">← Return to where you were</Link>}
        <div className="grid gap-7 lg:grid-cols-2">
          <TodaySuggestionsSection />
          <section>
            <h2 className="lapis-section">Go deeper</h2>
            <div className="lapis-group">
              <NavRow
                href="/goals"
                title="Work through a goal"
                description="Review your next step and get an idea"
                icon={Mountain}
              />
              <NavRow
                href="/gym/schedule"
                title="Review your training"
                description="Your schedule, volume and adjustments"
                icon={CalendarDays}
              />
              <NavRow
                href="/settings/ai-coach"
                title="Make it personal"
                description="Control suggestions and nutrition context"
                icon={Settings2}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
