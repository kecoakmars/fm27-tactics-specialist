"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AutoTacticThumbnail } from "../../../components/community/AutoTacticThumbnail";
import { UpvoteBookmarkBar } from "../../../components/community/UpvoteBookmarkBar";
import {
  sanitizeFileName,
  triggerBrowserDownload,
} from "../../../lib/local-folder-sync";
import type { CommunityTacticRecord } from "../../../lib/supabase-client";
import { exportFmfInWorker } from "../../../lib/worker-client";
import { useFolderSyncStore } from "../../../stores/useFolderSyncStore";
import { useLocale } from "../../../stores/useLocaleStore";
import { useTacticStore } from "../../../stores/useTacticStore";

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLocale();
  const loadTactic = useTacticStore((s) => s.loadTactic);
  const folderStatus = useFolderSyncStore((s) => s.status);
  const saveTacticFmfDirect = useFolderSyncStore((s) => s.saveTacticFmfDirect);

  const [item, setItem] = useState<CommunityTacticRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;

    (async () => {
      const res = await fetch(
        `/api/community/trending?id=${encodeURIComponent(params.id)}`,
      );
      if (!res.ok) {
        if (!cancelled) setNotFound(true);
        return;
      }
      const data = (await res.json()) as {
        kind: string;
        item: CommunityTacticRecord;
      };
      if (!cancelled && data.kind === "tactic") {
        setItem(data.item);
        void fetch("/api/analytics/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "tactic",
            entityId: data.item.id,
            eventType: "view",
          }),
        }).catch(() => undefined);
      } else if (!cancelled) {
        setNotFound(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <p className="text-sm text-rose-300">
          {t("Taktik tidak ditemukan.", "Tactic not found.")}
        </p>
        <Link
          href="/community"
          className="mt-3 inline-block text-xs text-cyan-300 underline"
        >
          ← {t("Kembali ke Komunitas", "Back to Community")}
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center text-xs text-slate-400">
        {t("Memuat taktik...", "Loading tactic...")}
      </main>
    );
  }

  async function handleDownloadFmf() {
    if (!item) return;
    const bytes = await exportFmfInWorker(item.tactic);
    triggerBrowserDownload(sanitizeFileName(item.title, ".fmf"), bytes);
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: "tactic",
        entityId: item.id,
        eventType: "download",
      }),
    }).catch(() => undefined);
  }

  async function handleSaveToFolder() {
    if (!item) return;
    const bytes = await exportFmfInWorker(item.tactic);
    const saved = await saveTacticFmfDirect(item.title, bytes);
    setSyncMessage(t(`Tersimpan ke ${saved}`, `Saved to ${saved}`));
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
      <div className="flex items-center justify-between">
        <Link
          href="/community"
          className="text-xs text-slate-400 hover:text-cyan-300"
        >
          ← {t("Kembali ke Komunitas", "Back to Community")}
        </Link>
        {syncMessage && (
          <span className="font-mono text-xs text-emerald-300">
            {syncMessage}
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-xs text-cyan-300">
                {item.playstyleTag}
              </span>
              <span className="font-mono text-xs text-slate-400">
                FM v{item.gameVersion}
              </span>
            </div>
            <h1 className="mt-1.5 text-xl font-bold text-slate-100">
              {item.title}
            </h1>
            <p className="text-xs text-slate-400">
              {t("Oleh", "By")} <strong>{item.authorName}</strong> ·{" "}
              {t("Skor", "Score")}{" "}
              <strong className="font-mono text-emerald-300">
                {item.balanceScore}/100
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UpvoteBookmarkBar
              entityType="tactic"
              entityId={item.id}
              initialUpvotes={item.upvotesCount}
              initialBookmarks={item.bookmarksCount}
            />
            <button
              type="button"
              onClick={() => {
                loadTactic(item.tactic);
                router.push("/");
              }}
              className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
            >
              {t("Coba di Papan Taktik", "Open on Tactics Board")}
            </button>
            {folderStatus === "connected" && (
              <button
                type="button"
                onClick={() => void handleSaveToFolder()}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-medium text-emerald-300 cursor-pointer"
              >
                {t("Simpan ke FM27", "Save to FM27")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDownloadFmf()}
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              {t("Unduh .fmf", "Download .fmf")}
            </button>
          </div>
        </div>

        <p className="mt-4 whitespace-pre-line rounded-xl border border-slate-800 bg-[#0B0F19] p-4 text-xs leading-relaxed text-slate-300">
          {item.description}
        </p>

        <div className="mt-4">
          <AutoTacticThumbnail tactic={item.tactic} large />
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-semibold text-slate-100">
            {t("Susunan Peran Pemain", "Player Roles")} (IP {item.ipFormation} → OOP{" "}
            {item.oopFormation})
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">{t("Menyerang (IP)", "In Possession")}</th>
                  <th className="py-2 pr-3">Duty</th>
                  <th className="py-2 pr-3">{t("Bertahan (OOP)", "Out of Possession")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {item.tactic.slots.map((slot) => (
                  <tr key={slot.slotIndex}>
                    <td className="py-1.5 pr-3 font-mono text-slate-500">
                      {slot.slotIndex + 1}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-200">
                      <span className="font-mono text-cyan-300">
                        {slot.inPossession.positionId}
                      </span>{" "}
                      · {slot.inPossession.roleId}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-emerald-300">
                      {slot.inPossession.duty}
                    </td>
                    <td className="py-1.5 pr-3 text-slate-200">
                      <span className="font-mono text-amber-300">
                        {slot.outOfPossession.positionId}
                      </span>{" "}
                      · {slot.outOfPossession.roleId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
