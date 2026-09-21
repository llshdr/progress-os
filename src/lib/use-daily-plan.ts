"use client";
import { useCallback } from "react";
import { createClient } from "./supabase/client";
import { loadDailyPlan } from "./daily-plan";
import { useUserResource } from "./use-user-resource";
import { getLocalDateString } from "./date";
export function useDailyPlan(date: string, raceId?: string) {
  const loader = useCallback(
    (uid: string) =>
      loadDailyPlan(createClient(), date, raceId, getLocalDateString(), uid),
    [date, raceId],
  );
  return useUserResource(`daily:${date}:${raceId ?? "active"}`, loader);
}
