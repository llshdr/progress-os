import { PageHeader, NavRow } from "@/components/lapis/page";
import AppLayout from "@/components/app-layout";
import {
  User,
  Dumbbell,
  Apple,
  Sparkles,
  Info,
  KeyRound,
  Link2,
  CalendarDays,
  Mountain,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  { title: "Your World", description: "Summit flag, landscapes and mountain order", href: "/settings/world", icon: Mountain },
  { title: "Connections & imports", description: "Calendar, mail, and workout imports", href: "/settings/connections", icon: Link2 },
  {
    title: "Account",
    description: "Display name and email",
    href: "/settings/account",
    icon: User,
  },
  {
    title: "Training",
    description: "Weekly target, units and phase",
    href: "/settings/training",
    icon: Dumbbell,
  },
  {
    title: "Nutrition",
    description: "Maintenance calories",
    href: "/settings/nutrition",
    icon: Apple,
  },
  {
    title: "Calendar",
    description: "Day schedule and temperature",
    href: "/settings/calendar",
    icon: CalendarDays,
  },
  {
    title: "AI Coach",
    description: "Suggestions and nutrition context",
    href: "/settings/ai-coach",
    icon: Sparkles,
  },
  {
    title: "About",
    description: "App name and version",
    href: "/settings/about",
    icon: Info,
  },
];

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isOwner = false;
  if (user) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    isOwner = roleRow?.role === "owner";
  }

  const sections = isOwner
    ? [
        ...SECTIONS,
        {
          title: "Invite Code",
          description: "View and rotate your code",
          href: "/owner/invite-code",
          icon: KeyRound,
        },
      ]
    : SECTIONS;

  return (
    <AppLayout>
      <div className="lapis-page max-w-3xl">
        <PageHeader
          title="Settings"
          subtitle="Make LAPIS yours."
          back={{ href: "/profile", label: "Profile" }}
        />
        <section className="mb-6">
          <h2 className="lapis-section">Account</h2>
          <div className="lapis-group">
            <NavRow
              href="/settings/account"
              title="Your account"
              description="Display name and email"
              icon={User}
            />
          </div>
        </section>
        <section className="mb-6">
          <h2 className="lapis-section">Preferences</h2>
          <div className="lapis-group">
            {sections
              .filter(
                (s) => !["Account", "About", "Invite Code"].includes(s.title),
              )
              .map((s) => (
                <NavRow
                  key={s.href}
                  href={s.href}
                  title={s.title}
                  description={s.description}
                  icon={s.icon}
                />
              ))}
          </div>
        </section>
        <section>
          <h2 className="lapis-section">App</h2>
          <div className="lapis-group">
            {sections
              .filter((s) => ["About", "Invite Code"].includes(s.title))
              .map((s) => (
                <NavRow
                  key={s.href}
                  href={s.href}
                  title={s.title}
                  description={s.description}
                  icon={s.icon}
                />
              ))}
          </div>
        </section>
        <p className="mt-8 text-center text-xs tracking-[.4em] text-lapis-text-tertiary">
          LAPIS
        </p>
      </div>
    </AppLayout>
  );
}
