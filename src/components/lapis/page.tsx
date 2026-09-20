import Link from "next/link";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
        >
          <ArrowLeft size={18} />
          {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="lapis-title">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="lapis-subtitle">{subtitle}</p>}
    </header>
  );
}
export function NavRow({
  href,
  title,
  description,
  icon: Icon,
  trailing,
}: {
  href: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  trailing?: string;
}) {
  return (
    <Link href={href} className="lapis-row">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lapis-surface-2">
        <Icon size={21} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {description && (
          <span className="mt-1 block text-sm text-lapis-text-secondary">
            {description}
          </span>
        )}
      </span>
      {trailing && (
        <span className="text-sm text-lapis-text-tertiary">{trailing}</span>
      )}
      <ChevronRight size={18} className="shrink-0 text-lapis-text-tertiary" />
    </Link>
  );
}
