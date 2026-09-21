"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/app-layout";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { LoadErrorBanner } from "@/components/ui/load-error-banner";
import BackLink from "@/components/lapis/back-link";
import { useLapis } from "@/components/lapis/app-provider";
import { useUserResource } from "@/lib/use-user-resource";

type PublicProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

async function loadProfiles(): Promise<PublicProfile[]> {
  const { data, error } = await createClient()
    .from("public_profiles")
    .select("user_id, display_name, avatar_url")
    .order("display_name", { ascending: true });
  if (error)
    throw new Error("Couldn't load everyone's profiles. Please retry.");
  return data ?? [];
}

export default function CompareProfilesPage() {
  const { identity } = useLapis();
  const { data, loading, error, refresh } = useUserResource(
    "people",
    loadProfiles,
  );
  const profiles = data ?? [];
  const ownUserId = identity?.id;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackLink fallback="/profile" className="mb-6" />

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
          People
        </h1>
        <p className="text-lapis-text-tertiary text-sm mb-6">
          The people sharing LAPIS with you. Your Level and activity stay
          personal.
        </p>

        <Link
          href="/profile/leaderboard"
          className="text-lapis-text-disabled hover:text-lapis-text-tertiary text-xs underline underline-offset-2 mb-8 inline-block"
        >
          See the strength leaderboard (real numbers) →
        </Link>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {error && (
              <div>
                <LoadErrorBanner message={error} />
                <button
                  onClick={refresh}
                  className="min-h-11 text-sm text-lapis-accent-400"
                >
                  Retry
                </button>
              </div>
            )}
            {!error && !profiles.length && (
              <p className="text-sm text-lapis-text-secondary">
                No shared profiles yet.
              </p>
            )}
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.user_id}
                  className={`border rounded-lapis-lg p-4 flex items-center gap-3 ${
                    profile.user_id === ownUserId
                      ? "border-lapis-border-strong bg-lapis-accent-500/[0.05]"
                      : "border-lapis-border-subtle bg-lapis-surface-1"
                  }`}
                >
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name}
                      className="w-12 h-12 rounded-full object-cover border border-lapis-border-subtle"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-lapis-surface-2 border border-lapis-border-subtle flex items-center justify-center text-lapis-text-tertiary">
                      {profile.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-lapis-text-primary font-medium">
                      {profile.display_name}
                      {profile.user_id === ownUserId && (
                        <span className="text-lapis-text-tertiary font-normal">
                          {" "}
                          (you)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
