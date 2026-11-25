import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community Tactical Gallery — FM27 Tactics Generator",
  description:
    "Explore, preview, and download FM27 community tactics, training schedules, and wonderkid shortlists.",
};

// shortcut: Supabase Community Gallery, Auto SVG .fmf Preview & AI Moderation arrive in Phase 5
export default function CommunityPage() {
  return (
    <main className="tactical-surface rounded-2xl p-6 flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-slate-100">Community Tactical Gallery</h1>
      <p className="text-sm text-slate-400 max-w-2xl">
        Upload `.fmf` tactics with auto-generated Dual-Phase SVG previews, semantic search, and
        calibrated moderation in Phase 5.
      </p>
      <div>
        <Link
          href="/"
          id="back-to-board-from-community"
          className="inline-block px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28"
        >
          Return to Dual-Phase Pitch Board
        </Link>
      </div>
    </main>
  );
}
