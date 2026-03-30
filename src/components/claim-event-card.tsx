import Link from "next/link";
import { ReactNode } from "react";

import { resolveAvatarSrc } from "@/lib/avatar-sprites";

type ClaimEventUser = {
  id?: number;
  handle: string;
  avatarType: string;
  avatarSprite: string;
  avatarSeed?: string | null;
  avatarPhotoDataUrl: string | null;
};

type ClaimEventCardProps = {
  user: ClaimEventUser;
  summary: ReactNode;
  message?: string | null;
  messageClassName?: string;
  actionHref?: string;
  actionLabel?: string;
};

export function ClaimEventCard({
  user,
  summary,
  message,
  messageClassName = "bg-[rgba(213,108,50,0.08)] text-[var(--accent-strong)]",
  actionHref,
  actionLabel = "Open location",
}: ClaimEventCardProps) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4">
      <div className="flex items-start gap-3">
        <img
          src={resolveAvatarSrc(user)}
          alt={user.handle}
          className="h-12 w-12 shrink-0 rounded-[14px] border border-[var(--line)] bg-white object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold leading-5">@{user.handle}</p>
          <div className="text-sm leading-6">{summary}</div>
          {message ? (
            <p className={`mt-2 rounded-2xl px-3 py-2 text-sm leading-6 ${messageClassName}`}>
              “{message}”
            </p>
          ) : null}
          {actionHref ? (
            <div className="mt-3">
              <Link
                href={actionHref}
                className="inline-flex rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--background-strong)]"
              >
                {actionLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}