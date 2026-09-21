"use client";
import { createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUserResource } from "@/lib/use-user-resource";
import { localTimezone, type WorldSummary } from "@/lib/world-progress";
const Context = createContext<{
  data: WorldSummary | null;
  error: boolean;
  refresh: () => void;
}>({ data: null, error: false, refresh: () => {} });
export const useWorld = () => useContext(Context);
async function loadProgress() {
  const { data, error } = await createClient().rpc("world_summary", {
    p_timezone: localTimezone(),
  });
  if (error) throw new Error("Progress couldn't refresh.");
  return data as WorldSummary;
}
export function WorldProvider({ children }: { children: React.ReactNode }) {
  const { data, error, refresh } = useUserResource("progress", loadProgress);
  return (
    <Context.Provider value={{ data, error: Boolean(error), refresh }}>
      {children}
    </Context.Provider>
  );
}
