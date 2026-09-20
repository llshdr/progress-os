import AppLayout from "@/components/app-layout";
import { PageHeader, NavRow } from "@/components/lapis/page";
import { Trophy, Scale, Flag, Moon, Target, History } from "lucide-react";
export default function GymProgressPage() {
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Progress"
          subtitle="The work adds up."
          back={{ href: "/gym", label: "Training" }}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="lapis-section">Explore</h2>
            <div className="lapis-group">
              <NavRow
                href="/gym/records"
                title="Personal records"
                description="Your lifts and running bests"
                icon={Trophy}
              />
              <NavRow
                href="/gym/weight"
                title="Weight tracking"
                description="Entries, trends and notes"
                icon={Scale}
              />
              <NavRow
                href="/gym/progress/races"
                title="Races"
                description="Upcoming events, plans and results"
                icon={Flag}
              />
              <NavRow
                href="/gym/sleep"
                title="Sleep"
                description="Hours and bedroom temperature"
                icon={Moon}
              />
            </div>
          </section>
          <section>
            <h2 className="lapis-section">Keep moving</h2>
            <div className="lapis-group">
              <NavRow
                href="/gym/goals"
                title="This week"
                description="Your quick-win goals"
                icon={Target}
              />
              <NavRow
                href="/gym/workouts"
                title="Training history"
                description="Every session in one place"
                icon={History}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
