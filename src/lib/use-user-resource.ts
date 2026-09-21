"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useLapis } from "@/components/lapis/app-provider";
import { emptyResource, userResource } from "./client-resource";
const noopSubscribe = () => () => {};
const empty = () => emptyResource;

// Pass a stable loader (module function or useCallback). Mutations invalidate
// all mounted readers once through AppProvider; stale content stays on screen.
export function useUserResource<T>(
  key: string,
  loader: (uid: string) => Promise<T>,
) {
  const { identity } = useLapis();
  const uid = identity?.id;
  const entry = uid ? userResource<T>(uid, key) : null;
  const snapshot = useSyncExternalStore(
    entry?.subscribe ?? noopSubscribe,
    entry?.read ?? empty,
    empty,
  );
  useEffect(() => {
    if (entry && uid) void entry.load(() => loader(uid));
  }, [entry, uid, loader, snapshot.revision]);
  return {
    data: snapshot.data,
    error: snapshot.error,
    loading: !snapshot.data && !snapshot.error,
    refresh: entry?.invalidate ?? (() => {}),
  };
}
