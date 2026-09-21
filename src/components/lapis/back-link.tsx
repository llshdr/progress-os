"use client";
import Link from "next/link";
import { useReturnNavigation } from "@/lib/use-return-navigation";
import { ArrowLeft } from "lucide-react";
export default function BackLink({
  fallback,
  children = "Back",
  className = "",
}: {
  fallback: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const goBack = useReturnNavigation(fallback);
  return (
    <Link
      href={fallback}
      className={`inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary hover:text-white ${className}`}
      onClick={(e) => {
        if (
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          e.button === 0
        ) {
          e.preventDefault();
          goBack();
        }
      }}
    >
      <ArrowLeft size={17} />
      {children}
    </Link>
  );
}
