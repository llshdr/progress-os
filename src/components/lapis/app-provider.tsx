"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import { clearResources, invalidateResources } from "@/lib/client-resource";
import { trackNavigation } from "@/lib/navigation-history";
import { createClient } from "@/lib/supabase/client";
type Identity = { id: string; name: string; avatar: string | null };
type Active = { id: string; workout_type: string | null };
const Context = createContext<{
  identity: Identity | null;
  active: Active | null;
  refresh: () => void;
}>({ identity: null, active: null, refresh: () => {} });
export const useLapis = () => useContext(Context);
export const changed = () => window.dispatchEvent(new Event("lapis:changed"));
export function AppProvider({ children }: { children: React.ReactNode }) {
  const isAuth = usePathname() === "/auth";
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const authOwner = useRef<string | null>(null);
  const lastIdentityLoad = useRef(0);
  useEffect(trackNavigation, []);
  useEffect(() => {
    const db = createClient();
    const { data } = db.auth.onAuthStateChange((event, session) => {
      const uid = session?.user.id ?? null;
      if (event === "INITIAL_SESSION") {
        authOwner.current = uid;
        if (session?.user)
          setIdentity((previous) =>
            previous?.id === uid
              ? previous
              : {
                  id: session.user.id,
                  name: session.user.user_metadata?.full_name || "You",
                  avatar: null,
                },
          );
      }
      if (event === "SIGNED_OUT") {
        authOwner.current = null;
        clearResources();
        refresh();
        setIdentity(null);
        setActive(null);
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("lapis:draft:"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          /* Storage may be disabled. */
        }
      }
      if (event === "SIGNED_IN" && uid !== authOwner.current) {
        authOwner.current = uid;
        clearResources();
        setIdentity(null);
        setActive(null);
        refresh();
      }
      if (event === "USER_UPDATED") refresh();
    });
    const onChanged = () => {
      invalidateResources();
      refresh();
    };
    const onFocus = () => {
      invalidateResources(true);
      if (Date.now() - lastIdentityLoad.current > 60_000) refresh();
    };
    const onOnline = () => {
      invalidateResources();
      refresh();
    };
    window.addEventListener("lapis:changed", onChanged);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("lapis:changed", onChanged);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);
  useEffect(() => {
    if (isAuth) return;
    let live = true;
    const db = createClient();
    void (async () => {
      const {
        data: { user },
        error: authError,
      } = await db.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        if (live) {
          setIdentity(null);
          setActive(null);
        }
        return;
      }
      const [profile, workout] = await Promise.all([
        db
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        db
          .from("workouts")
          .select("id, workout_type")
          .eq("user_id", user.id)
          .is("completed_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (live) {
        lastIdentityLoad.current = Date.now();
        setIdentity((previous) => ({
          id: user.id,
          name:
            profile.data?.full_name ||
            (previous?.id === user.id ? previous.name : null) ||
            user.user_metadata?.full_name ||
            "You",
          avatar:
            profile.error && previous?.id === user.id
              ? previous.avatar
              : (profile.data?.avatar_url ?? null),
        }));
        if (!workout.error) setActive(workout.data ?? null);
      }
    })().catch(() => {
      /* Keep the last loaded identity during a temporary connection failure. */
    });
    return () => {
      live = false;
    };
  }, [isAuth, revision]);
  return (
    <Context.Provider value={{ identity, active, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function Avatar({ className = "" }: { className?: string }) {
  const { identity } = useLapis();
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lapis-accent-500/20 text-xs font-semibold text-lapis-accent-400 ${className}`}
    >
      {/* Avatar URLs are user-selected storage assets, rendered directly. */}
      {identity?.avatar && broken !== identity.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- User-selected avatar URL.
        <img
          src={identity.avatar}
          alt=""
          onError={() => setBroken(identity.avatar)}
          className="size-full object-cover"
        />
      ) : (
        (identity?.name ?? "You")
          .split(" ")
          .slice(0, 2)
          .map((s) => s[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  );
}
