"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sun,
  Dumbbell,
  Target,
  Sparkles,
  Apple,
  CalendarDays,
  Settings,
  Play,
  Flag,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { Avatar, useLapis } from "./lapis/app-provider";
import CommandMenu from "./lapis/command-menu";
const primary = [
  {
    name: "Today",
    href: "/dashboard",
    icon: Sun,
    paths: ["/dashboard", "/today"],
  },
  { name: "Training", href: "/gym", icon: Dumbbell, paths: ["/gym"] },
  {
    name: "Plan",
    href: "/plan",
    icon: CalendarDays,
    paths: ["/plan", "/calendar"],
  },
  {
    name: "Goals",
    href: "/goals",
    icon: Target,
    paths: ["/journey", "/goals"],
  },
];
const training = [
  ["Sessions", "/gym/workouts", Dumbbell],
  ["Races", "/gym/progress/races", Flag],
  ["Progress", "/gym/progress", TrendingUp],
  ["Library", "/gym/library", BookOpen],
] as const;
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { identity, active } = useLapis();
  const matches = (paths: string[]) =>
    paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const resume = active && pathname !== `/gym/workouts/${active.id}`;
  return (
    <div className="min-h-dvh bg-lapis-bg text-lapis-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-lapis-surface-2 focus:p-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-lapis-border-subtle bg-lapis-surface-1/40 md:flex">
        <Link
          href="/dashboard"
          className="px-7 py-8 text-sm font-semibold tracking-[.4em]"
        >
          LAPIS
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3"
        >
          {primary.map(({ name, href, icon: Icon, paths }) => (
            <Link
              key={href}
              href={href}
              aria-current={matches(paths) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium ${matches(paths) ? "bg-lapis-accent-500/15 text-lapis-accent-400" : "text-lapis-text-secondary hover:bg-lapis-surface-2"}`}
            >
              <Icon size={20} />
              {name}
            </Link>
          ))}
          <div className="my-5 border-t border-lapis-border-subtle" />
          {[
            { name: "Nutrition", href: "/nutrition", icon: Apple },
            { name: "Coach", href: "/coach", icon: Sparkles },
            { name: "Settings", href: "/settings", icon: Settings },
          ].map(({ name, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={matches([href]) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm ${matches([href]) ? "bg-lapis-surface-2 text-white" : "text-lapis-text-secondary"}`}
            >
              <Icon size={18} />
              {name}
            </Link>
          ))}
        </nav>
        <Link
          href="/profile"
          className="m-3 flex items-center gap-3 rounded-xl p-3 hover:bg-lapis-surface-2"
        >
          <Avatar />
          <span>
            <strong className="block text-sm">
              {identity?.name || "Your profile"}
            </strong>
            <span className="text-xs text-lapis-text-secondary">
              Your progress & account
            </span>
          </span>
        </Link>
      </aside>
      <div className="md:ml-60">
        <header className="flex items-center justify-between gap-3 px-5 pt-[max(.75rem,env(safe-area-inset-top))] md:px-10">
          <Link
            href="/dashboard"
            className="text-xs font-semibold tracking-[.3em] md:hidden"
          >
            LAPIS
          </Link>
          <p className="hidden text-xs text-lapis-text-tertiary md:block">
            {pathname
              .split("/")
              .filter(Boolean)
              .filter((s) => !/[0-9a-f]{8}-/.test(s))
              .slice(0, 2)
              .map((s) =>
                s === "gym"
                  ? "Training"
                  : s === "dashboard"
                    ? "Today"
                    : s[0].toUpperCase() + s.slice(1),
              )
              .join(" / ")}
          </p>
          <nav aria-label="Tools" className="flex items-center gap-2">
            <Link
              href="/nutrition"
              aria-label="Nutrition"
              className="lapis-icon-button md:hidden"
            >
              <Apple size={18} />
            </Link>
            <CommandMenu />
            <Link
              href={`/coach?context=${encodeURIComponent(pathname)}`}
              className="lapis-icon-button"
              aria-label="Open Coach"
            >
              <Sparkles size={18} />
            </Link>
            <Link
              href="/profile"
              className="lapis-icon-button md:hidden"
              aria-label="Your profile"
            >
              <Avatar />
            </Link>
          </nav>
        </header>
        {pathname.startsWith("/gym") && (
          <nav aria-label="Training sections" className="lapis-training-nav">
            {training.map(([name, href, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  (
                    href === "/gym/progress"
                      ? matches([
                          href,
                          "/gym/records",
                          "/gym/weight",
                          "/gym/sleep",
                          "/gym/goals",
                        ]) && !pathname.includes("/races")
                      : href === "/gym/library"
                        ? matches([href, "/gym/exercises", "/gym/templates"])
                        : href === "/gym/workouts"
                          ? matches([href, "/gym/train", "/gym/schedule"])
                          : matches([href])
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon size={16} />
                {name}
              </Link>
            ))}
          </nav>
        )}
        <main
          id="main-content"
          className={`min-w-0 md:pb-12 ${resume ? "pb-44" : "pb-28"}`}
        >
          {children}
        </main>
      </div>
      {resume && (
        <Link href={`/gym/workouts/${active.id}`} className="lapis-resume">
          <span className="flex size-9 items-center justify-center rounded-full bg-lapis-accent-500">
            <Play size={15} fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm">
              {active.workout_type || "Workout in progress"}
            </strong>
            <span className="text-xs text-lapis-text-secondary">
              Resume session
            </span>
          </span>
          <span className="size-2 rounded-full bg-lapis-jade" />
        </Link>
      )}
      <nav aria-label="Main navigation" className="lapis-bottom-nav">
        <ul className="grid grid-cols-4 gap-1">
          {primary.map(({ name, href, icon: Icon, paths }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={matches(paths) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.6rem] text-[11px] font-medium ${matches(paths) ? "bg-lapis-accent-400/15 text-lapis-accent-400" : "text-lapis-text-secondary"}`}
              >
                <Icon size={22} strokeWidth={1.7} />
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
