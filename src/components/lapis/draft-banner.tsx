"use client";
import { CloudOff } from "lucide-react";
export default function DraftBanner({
  recoverable,
  status,
  onRestore,
  onDiscard,
}: {
  recoverable: boolean;
  status: "none" | "saved" | "unavailable";
  onRestore: () => void;
  onDiscard: () => void;
}) {
  if (!recoverable && status === "none") return null;
  return (
    <div
      className="mb-4 rounded-xl border border-lapis-border bg-lapis-surface-2 p-3 text-sm"
      role="status"
    >
      <div className="flex items-start gap-2">
        <CloudOff size={17} className="mt-0.5 shrink-0 text-lapis-accent-400" />
        <span>
          {recoverable
            ? "An unsaved draft is available on this device."
            : status === "saved"
              ? "Draft saved on this device. Save to sync it to your account."
              : "Device storage is unavailable. Keep this page open until you save."}
        </span>
      </div>
      {recoverable && (
        <div className="mt-2 flex gap-4">
          <button
            onClick={onRestore}
            type="button"
            className="min-h-11 text-lapis-accent-400"
          >
            Restore draft
          </button>
          <button
            onClick={onDiscard}
            type="button"
            className="min-h-11 text-lapis-text-secondary"
          >
            Discard draft
          </button>
        </div>
      )}
    </div>
  );
}
