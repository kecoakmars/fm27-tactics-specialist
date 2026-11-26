"use client";

import Link from "next/link";
import { useLocale } from "@/stores/useLocaleStore";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="w-full rounded-2xl border border-rose-500/40 bg-[#111827] p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-100">
          {t("Terjadi kendala saat memuat halaman", "Something went wrong")}
        </h2>
        <p className="mt-1.5 text-xs text-slate-400">
          {error.message || t("Silakan muat ulang tampilan.", "Please try reloading the page.")}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            {t("Coba Lagi", "Try Again")}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-cyan-500/40"
          >
            {t("Kembali ke Papan Taktik", "Back to Tactics")}
          </Link>
        </div>
      </div>
    </main>
  );
}
