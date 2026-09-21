"use client";
import { useSyncExternalStore, type SetStateAction } from "react";
const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  window.addEventListener("lapis:view", notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("lapis:view", notify);
  };
};
export function usePageState<T extends string>(
  key: string,
  fallback: T,
  valid: (value: string) => boolean = () => true,
) {
  const read = (): T => {
    let value = new URLSearchParams(location.search).get(key);
    try {
      value ??= sessionStorage.getItem(
        `lapis:view:${location.pathname}:${key}`,
      );
    } catch {
      /* The URL remains available. */
    }
    return value !== null && valid(value) ? (value as T) : fallback;
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const setValue = (next: SetStateAction<T>) => {
    const updated = typeof next === "function" ? next(read()) : next;
    const url = new URL(location.href);
    if (updated) url.searchParams.set(key, updated);
    else url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
    try {
      sessionStorage.setItem(`lapis:view:${location.pathname}:${key}`, updated);
    } catch {
      /* Private browsing may disable storage. */
    }
    window.dispatchEvent(new Event("lapis:view"));
  };
  return [value, setValue] as const;
}
