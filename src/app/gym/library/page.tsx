import AppLayout from "@/components/app-layout";
import { PageHeader, NavRow } from "@/components/lapis/page";
import { Dumbbell, LayoutTemplate, Plus } from "lucide-react";
import Link from "next/link";
export default function LibraryPage() {
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Library"
          subtitle="The building blocks of your training."
          back={{ href: "/gym", label: "Training" }}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="lapis-section">Your collection</h2>
            <div className="lapis-group">
              <NavRow
                href="/gym/exercises"
                title="Exercises"
                description="Browse, search and manage your exercises"
                icon={Dumbbell}
              />
              <NavRow
                href="/gym/templates"
                title="Templates"
                description="Your reusable workout routines"
                icon={LayoutTemplate}
              />
            </div>
          </section>
          <section>
            <h2 className="lapis-section">Make it yours</h2>
            <div className="lapis-group">
              <NavRow
                href="/gym/exercises/new"
                title="Add exercise"
                description="Build your personal exercise library"
                icon={Plus}
              />
              <NavRow
                href="/gym/templates/new"
                title="Create template"
                description="Organize exercises into a session"
                icon={Plus}
              />
            </div>
            <Link
              href="/gym/schedule"
              className="mt-5 inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
            >
              Use your templates in a schedule →
            </Link>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
