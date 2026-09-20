"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JourneyGoal } from "./journey";
export function useJourney() {
  const [goals, setGoals] = useState<JourneyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const db = createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new Error("Sign in required");
        // select * allows older databases to render with scope-derived scenery.
        const result = await db
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (result.error) throw result.error;
        if (alive) setGoals((result.data ?? []) as JourneyGoal[]);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);
  return { goals, loading, error };
}
