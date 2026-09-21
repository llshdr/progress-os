"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Settings, Users, Link2 } from "lucide-react";
import AppLayout from "@/components/app-layout";
import { Avatar, changed, useLapis } from "@/components/lapis/app-provider";
import BackLink from "@/components/lapis/back-link";
import { NavRow } from "@/components/lapis/page";
import WorldMeter from "@/components/lapis/world-meter";
import { useWorld } from "@/components/lapis/world-provider";
import Achievements from "@/components/profile/achievements";
import { createClient } from "@/lib/supabase/client";
import { resizeImageFile } from "@/lib/image";
export default function ProfilePage() {
  const { identity } = useLapis();
  const { data } = useWorld();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  async function selectPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !identity) return;
    setUploading(true);
    setError(null);
    const db = createClient();
    try {
      const resized = await resizeImageFile(file);
      const path = `${identity.id}/${Date.now()}.jpg`;
      const upload = await db.storage
        .from("avatars")
        .upload(path, resized, { contentType: "image/jpeg", upsert: true });
      if (upload.error) throw upload.error;
      const { data: url } = db.storage.from("avatars").getPublicUrl(path);
      const result = await db
        .from("profiles")
        .upsert(
          { id: identity.id, avatar_url: url.publicUrl },
          { onConflict: "id" },
        );
      if (result.error) throw result.error;
      changed();
    } catch {
      setError("Your photo couldn't save. Please try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  return (
    <AppLayout>
      <div className="lapis-page max-w-5xl">
        <BackLink fallback="/dashboard" className="mb-4" />
        <header className="mb-8 flex flex-wrap items-center gap-5">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading || !identity}
            className="relative rounded-full"
            aria-label="Change profile photo"
          >
            <Avatar className="!size-20 !text-2xl" />
            <span className="absolute -bottom-1 -right-1 rounded-full border border-lapis-border bg-lapis-surface-2 p-2">
              <Camera size={15} />
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={selectPhoto}
            className="hidden"
            aria-label="Profile photo file"
          />
          <div className="min-w-0 flex-1">
            <p className="lapis-eyebrow">Your profile</p>
            <h1 className="lapis-title mt-2 break-words">
              {identity?.name || "You"}
            </h1>
            <p className="mt-2 text-sm text-lapis-text-secondary">
              {uploading
                ? "Saving your photo…"
                : "The work you put in. The progress you keep."}
            </p>
          </div>
          <Link
            href="/settings"
            className="lapis-icon-button"
            aria-label="Open settings"
          >
            <Settings size={21} />
          </Link>
        </header>
        {error && (
          <p role="alert" className="mb-5 text-sm text-lapis-garnet">
            {error}
          </p>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <WorldMeter />
            {identity && <Achievements userId={identity.id} />}
          </div>
          <div className="space-y-6">
            <section className="lapis-panel">
              <h2 className="text-lg font-semibold">Recent progress</h2>
              <p className="mt-1 mb-4 text-sm text-lapis-text-secondary">
                Small actions that add up.
              </p>
              {data?.activity.length ? (
                data.activity.slice(0, 5).map((item, i) => (
                  <Link
                    key={`${item.kind}-${item.day}-${i}`}
                    href={item.href || "/plan"}
                    className="flex min-h-16 items-center justify-between gap-4 border-t border-lapis-border-subtle py-3"
                  >
                    <span className="min-w-0">
                      <strong className="block text-sm font-medium">
                        {item.title}
                      </strong>
                      <span className="text-xs text-lapis-text-secondary">
                        {new Date(item.day + "T12:00:00").toLocaleDateString(
                          "en",
                          { day: "numeric", month: "short" },
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-lapis-accent-400">
                      +{item.xp} XP
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-lapis-text-secondary">
                  Your logged training, habits and goal check-ins will appear
                  here.
                </p>
              )}
            </section>
            <div className="lapis-group">
              <NavRow
                href="/settings/account"
                title="Account"
                description="Your name and account details"
                icon={Settings}
              />
              <NavRow
                href="/settings/connections"
                title="Connections"
                description="Connected accounts and reviewed imports"
                icon={Link2}
              />
              <NavRow
                href="/profile/compare"
                title="People"
                description="The people sharing LAPIS with you"
                icon={Users}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
