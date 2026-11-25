import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "U-21 Wonderkids Ranker — FM27 Tactics Generator",
  description:
    "Discover curated FM27 U-21 wonderkids ranked by Role Fit Score and Value Ratio for your active dual-phase tactic.",
};

// shortcut: interactive Wonderkid cards, filters, shortlist .fmf exporter & trending tab arrive in Phase 4-5
export default function WonderkidsPage() {
  return (
    <main className="tactical-surface rounded-2xl p-6 flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-slate-100">U-21 Wonderkids Scout &amp; Shortlist</h1>
      <p className="text-sm text-slate-400 max-w-2xl">
        189 curated U-21 wonderkids and the 55/30/15 Value Ratio ranker + `.slf` binary `.fmf`
        shortlist exporter are loaded in `@fm27/fm-data` and `@fm27/fm-codec`. Full interactive
        filtering &amp; shortlist builder UI arrives in Phase 4.
      </p>
      <div>
        <Link
          href="/"
          id="back-to-board-from-wonderkids"
          className="inline-block px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28"
        >
          Return to Dual-Phase Pitch Board
        </Link>
      </div>
    </main>
  );
}
