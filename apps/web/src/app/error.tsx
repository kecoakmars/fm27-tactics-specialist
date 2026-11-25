"use client";

import Link from "next/link";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-2xl border border-rose-500/40 bg-[#111827] p-6 shadow-xl">
        <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-rose-300">
          Runtime Recovery Boundary
        </span>
        <h2 className="mt-2 text-lg font-bold text-slate-100">
          Something interrupted the tactical workspace
        </h2>
        <p className="mt-1.5 font-mono text-xs text-slate-400">
          {error.message || "Unexpected rendering error"}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Retry View
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-cyan-500/40"
          >
            Return to Pitch Board
          </Link>
        </div>
      </div>
    </main>
  );
}
