"use client";
import { useRouter } from "next/navigation";
import { canReturn } from "./navigation-history";
export function useReturnNavigation(fallback: string) {
  const router = useRouter();
  return () => {
    if (canReturn()) router.back();
    else router.replace(fallback);
  };
}
