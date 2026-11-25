"use client";

import { useState } from "react";

interface UpvoteBookmarkBarProps {
  entityType: "tactic" | "schedule" | "shortlist";
  entityId: string;
  initialUpvotes: number;
  initialBookmarks: number;
}

export function UpvoteBookmarkBar({
  entityType,
  entityId,
  initialUpvotes,
  initialBookmarks,
}: UpvoteBookmarkBarProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [upvoted, setUpvoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  async function handleAction(action: "upvote" | "bookmark") {
    if (action === "upvote") {
      if (upvoted) return;
      setUpvoted(true);
      setUpvotes((v) => v + 1);
    } else {
      if (bookmarked) return;
      setBookmarked(true);
      setBookmarks((v) => v + 1);
    }

    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType,
        entityId,
        eventType: action,
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleAction("upvote")}
        className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
          upvoted
            ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
            : "border-slate-700 bg-[#0B0F19] text-slate-300 hover:border-emerald-500/40"
        }`}
      >
        ▲ {upvotes}
      </button>
      <button
        type="button"
        onClick={() => void handleAction("bookmark")}
        className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${
          bookmarked
            ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
            : "border-slate-700 bg-[#0B0F19] text-slate-300 hover:border-amber-500/40"
        }`}
      >
        ★ {bookmarks}
      </button>
    </div>
  );
}
