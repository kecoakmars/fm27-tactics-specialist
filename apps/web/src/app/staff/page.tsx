import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Staff Star Calculator & Assignment Optimizer — FM27 Tactics Generator",
  description:
    "Calculate 0.5-5.0 coaching stars across all 10 FM27 training categories and optimize coach workloads.",
};

// shortcut: interactive Staff Star Calculator & Auto-Assign Optimizer UI arrive in Phase 4
export default function StaffPage() {
  return (
    <main className="tactical-surface rounded-2xl p-6 flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-slate-100">
        Staff Star Calculator &amp; Workload Optimizer
      </h1>
      <p className="text-sm text-slate-400 max-w-2xl">
        10-category DDM star formulas, 42 curated coaches &amp; free agents, and the Light/Average
        workload solver are ready in `@fm27/fm-engine`. Interactive calculator &amp; importer UI
        arrives in Phase 4.
      </p>
      <div>
        <Link
          href="/"
          id="back-to-board-from-staff"
          className="inline-block px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28"
        >
          Return to Dual-Phase Pitch Board
        </Link>
      </div>
    </main>
  );
}
