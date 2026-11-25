import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Squad Audit & Optimizer — FM27 Tactics Generator",
  description:
    "Import FM27 squad CSV/HTML exports, run Kuhn-Munkres Hungarian Starting XI optimization, and inspect the 3 weakest positions.",
};

// shortcut: interactive Squad Importer, Role Fit Table & Replacement Modal arrive in Phase 4
export default function SquadPage() {
  return (
    <main className="tactical-surface rounded-2xl p-6 flex flex-col gap-3">
      <h1 className="text-xl font-extrabold text-slate-100">Squad Audit & Tactical Optimizer</h1>
      <p className="text-sm text-slate-400 max-w-2xl">
        Core deterministic squad analysis (`@fm27/fm-engine` Hungarian solver, `fmsave` &amp; `F9`
        CSV/HTML parsers, and 3-weakest-slot audit) is active in the worker engine. Full
        interactive Squad Importer &amp; Instant Replacement UI is scheduled in Phase 4.
      </p>
      <div>
        <Link
          href="/"
          id="back-to-board-from-squad"
          className="inline-block px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500/18 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/28"
        >
          Return to Dual-Phase Pitch Board
        </Link>
      </div>
    </main>
  );
}
