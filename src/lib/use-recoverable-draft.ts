"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Hydrates browser-only draft storage and reports write availability after mount. */
import { useEffect, useRef, useState } from "react";
import { useLapis } from "@/components/lapis/app-provider";

export function useRecoverableDraft<T>(name: string, value: T, dirty: boolean) {
  const { identity } = useLapis();
  const key = identity ? `lapis:draft:${identity.id}:${name}` : null;
  const [recovery, setRecovery] = useState<T | null>(null);
  const [status, setStatus] = useState<"none" | "saved" | "unavailable">(
    "none",
  );
  const [ready, setReady] = useState(false);
  const awaiting = useRef(false);
  const skip = useRef(false);
  useEffect(() => {
    setReady(false);
    awaiting.current = false;
    skip.current = false;
    setRecovery(null);
    setStatus("none");
    try {
      const raw = key ? localStorage.getItem(key) : null;
      if (raw) {
        const record = JSON.parse(raw);
        if (Date.now() - record.at < 30 * 86400000) {
          awaiting.current = true;
          setRecovery(record.value);
        } else if (key) localStorage.removeItem(key);
      }
    } catch {
      setStatus("unavailable");
    }
    setReady(true);
  }, [key]);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!ready || !key || awaiting.current) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    try {
      if (dirty) {
        localStorage.setItem(
          key,
          JSON.stringify({ at: Date.now(), value: JSON.parse(serialized) }),
        );
        setStatus("saved");
      } else {
        localStorage.removeItem(key);
        setStatus("none");
      }
    } catch {
      setStatus("unavailable");
    }
  }, [serialized, dirty, ready, key]);
  function consume() {
    const data = recovery;
    awaiting.current = false;
    setRecovery(null);
    return data;
  }
  function discard() {
    awaiting.current = false;
    setRecovery(null);
    try {
      if (key) localStorage.removeItem(key);
      setStatus("none");
    } catch {
      setStatus("unavailable");
    }
  }
  function clear() {
    skip.current = true;
    discard();
  }
  return { recovery, status, consume, discard, clear };
}
