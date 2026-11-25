import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Adaptive Training & Weekly Schedule Builder — FM27 Tactics Generator",
  description:
    "Build 7x3 weekly FM27 training schedules with real-time fatigue, condition, sharpness, and injury risk meters.",
};

// shortcut: interactive 7x3 Weekly Schedule Grid & Smart Recommendations UI arrive in Phase 4
export default function TrainingPage() {
  return (
    <main className="tactical-surface rounded-2xl p-6 flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-slate-100">
        Smart Training &amp; 7×3 Weekly Schedule Builder
      </h1>
      <p className="text-sm text-slate-400 max-w-2xl">
        28 FM27 training sessions, 4 weekly presets, load/fatigue validator, and `.tsc` binary
        `.fmf` schedule exporter are ready. Interactive drag-and-drop grid arrives in Phase 4.
      </p>
      <div>
        <Link
          href="/"
          id="back-to-board-from-training"
          className="inline-block px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28"
        >
          Return to Dual-Phase Pitch Board
        </Link>
      </div>
    </main>
  );
}
