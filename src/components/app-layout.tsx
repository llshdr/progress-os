"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sun,
  Dumbbell,
  Mountain,
  Sparkles,
  Apple,
  CalendarDays,
  Settings,
  UserRound,
} from "lucide-react";

const primary = [
  {
    name: "Today",
    href: "/dashboard",
    icon: Sun,
    matches: ["/dashboard", "/today"],
  },
  { name: "Training", href: "/gym", icon: Dumbbell, matches: ["/gym"] },
  {
    name: "Journey",
    href: "/journey",
    icon: Mountain,
    matches: ["/journey", "/goals"],
  },
  { name: "Coach", href: "/coach", icon: Sparkles, matches: ["/coach"] },
];
const utilities = [
  { name: "Nutrition", href: "/nutrition", icon: Apple },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Profile", href: "/profile", icon: UserRound },
  { name: "Settings", href: "/settings", icon: Settings },
];
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (paths: string[]) =>
    paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
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
          className="px-7 py-9 text-sm font-semibold tracking-[.4em]"
        >
          LAPIS
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
          {primary.map(({ name, href, icon: Icon, matches }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(matches) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium ${active(matches) ? "bg-lapis-accent-500/15 text-lapis-accent-400" : "text-lapis-text-secondary hover:bg-lapis-surface-2"}`}
            >
              <Icon size={20} />
              {name}
            </Link>
          ))}
          <div className="my-6 border-t border-lapis-border-subtle" />
          {utilities.map(({ name, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active([href]) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm ${active([href]) ? "bg-lapis-surface-2 text-white" : "text-lapis-text-secondary hover:bg-lapis-surface-2"}`}
            >
              <Icon size={18} />
              {name}
            </Link>
          ))}
        </nav>
        <p className="px-7 py-6 text-xs text-lapis-text-tertiary">
          Built by what you do.
        </p>
      </aside>
      <div className="md:ml-60">
        <header className="flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
          <Link
            href="/dashboard"
            aria-label="LAPIS home"
            className="text-xs font-semibold tracking-[.3em]"
          >
            LAPIS
          </Link>
          <nav aria-label="Tools" className="flex gap-1.5">
            {utilities.map(({ name, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={name}
                aria-current={active([href]) ? "page" : undefined}
                className={`lapis-icon-button ${active([href]) ? "text-lapis-accent-400" : ""}`}
              >
                <Icon size={18} />
              </Link>
            ))}
          </nav>
        </header>
        <main
          id="main-content"
          className="min-w-0 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Main navigation"
        className="fixed bottom-[max(.75rem,env(safe-area-inset-bottom))] left-4 right-4 z-40 rounded-[2rem] border border-white/15 bg-[#182432]/90 p-1.5 shadow-[0_8px_32px_#0009,inset_0_1px_0_#ffffff15] backdrop-blur-2xl md:hidden"
      >
        <ul className="grid grid-cols-4 gap-1">
          {primary.map(({ name, href, icon: Icon, matches }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(matches) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.6rem] text-[11px] font-medium ${active(matches) ? "bg-lapis-accent-400/15 text-lapis-accent-400" : "text-lapis-text-secondary"}`}
              >
                <Icon size={23} strokeWidth={1.7} />
                {name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
