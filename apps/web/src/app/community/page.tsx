"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listPatchVersions } from "@fm27/fm-data";
import { AutoTacticThumbnail } from "../../components/community/AutoTacticThumbnail";
import { FmfDropzoneUploader } from "../../components/community/FmfDropzoneUploader";
import { UpvoteBookmarkBar } from "../../components/community/UpvoteBookmarkBar";
import {
  sanitizeFileName,
  triggerBrowserDownload,
} from "../../lib/local-folder-sync";
import type {
  CommunityScheduleRecord,
  CommunityShortlistRecord,
  CommunityTacticRecord,
} from "../../lib/supabase-client";
import {
  exportFmfInWorker,
  exportScheduleFmfInWorker,
  exportShortlistFmfInWorker,
} from "../../lib/worker-client";
import { useLocale } from "../../stores/useLocaleStore";
import { useTacticStore } from "../../stores/useTacticStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

export default function CommunityGalleryPage() {
  const router = useRouter();
  const { t } = useLocale();
  const loadTactic = useTacticStore((s) => s.loadTactic);
  const loadSchedule = useTrainingStore((s) => s.loadSchedule);
  const setShortlist = useTrainingStore((s) => s.setShortlist);

  const [category, setCategory] = useState<
    "tactics" | "schedules" | "shortlists"
  >("tactics");
  const [gameVersion, setGameVersion] = useState<string>("");
  const [playstyleTag, setPlaystyleTag] = useState<string>("");
  const [ipFormation, setIpFormation] = useState<string>("");
  const [sortBy, setSortBy] = useState<"trending" | "top_upvoted" | "newest">(
    "trending",
  );
  const [semanticQuery, setSemanticQuery] = useState<string>("");

  const [tactics, setTactics] = useState<CommunityTacticRecord[]>([]);
  const [schedules, setSchedules] = useState<CommunityScheduleRecord[]>([]);
  const [shortlists, setShortlists] = useState<CommunityShortlistRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("category", category);
      qs.set("sortBy", sortBy);
      if (gameVersion) qs.set("gameVersion", gameVersion);
      if (playstyleTag) qs.set("playstyleTag", playstyleTag);
      if (ipFormation) qs.set("ipFormation", ipFormation);
      if (semanticQuery.trim()) qs.set("query", semanticQuery.trim());

      const res = await fetch(`/api/community/trending?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        tactics: CommunityTacticRecord[];
        schedules: CommunityScheduleRecord[];
        shortlists: CommunityShortlistRecord[];
      };
      setTactics(data.tactics ?? []);
      setSchedules(data.schedules ?? []);
      setShortlists(data.shortlists ?? []);
    } finally {
      setLoading(false);
    }
  }, [category, gameVersion, playstyleTag, ipFormation, sortBy, semanticQuery]);

  useEffect(() => {
    void fetchGallery();
  }, [fetchGallery]);

  async function handleDownloadTacticFmf(item: CommunityTacticRecord) {
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

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-100">
          {t("Komunitas Taktik", "Community Hub")}
        </h1>

        <FmfDropzoneUploader onSubmitted={() => void fetchGallery()} />
      </div>

      <section className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "tactics", label: `${t("Taktik", "Tactics")} (${tactics.length})` },
                { id: "schedules", label: `${t("Jadwal Latihan", "Training Schedules")} (${schedules.length})` },
                { id: "shortlists", label: `Shortlist (${shortlists.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  category === tab.id
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={gameVersion}
              onChange={(e) => setGameVersion(e.target.value)}
              className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="">{t("Semua Patch", "All Patches")}</option>
              {listPatchVersions().map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>

            {category === "tactics" && (
              <>
                <select
                  value={playstyleTag}
                  onChange={(e) => setPlaystyleTag(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="">{t("Semua Gaya", "All Styles")}</option>
                  <option value="gegenpress">Gegenpress</option>
                  <option value="possession">Possession</option>
                  <option value="counter">Counter-Attack</option>
                  <option value="wing_play">Wing Play</option>
                  <option value="balanced">Balanced</option>
                </select>

                <input
                  type="text"
                  placeholder={t("Formasi (cth. 4-3-3 DM)", "Formation (e.g. 4-3-3 DM)")}
                  value={ipFormation}
                  onChange={(e) => setIpFormation(e.target.value)}
                  className="w-44 rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200"
                />
              </>
            )}

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "trending" | "top_upvoted" | "newest",
                )
              }
              className="rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="trending">{t("Populer Minggu Ini", "Trending")}</option>
              <option value="top_upvoted">{t("Paling Disukai", "Top Rated")}</option>
              <option value="newest">{t("Terbaru", "Newest")}</option>
            </select>
          </div>
        </div>

        {category === "tactics" && (
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              placeholder={t(
                'Cari taktik (contoh: "taktik 3 bek aman buat tim papan tengah" atau "4-3-3 high press")',
                'Search tactics (e.g. "4-3-3 high press" or "solid 3-back counter")',
              )}
              className="flex-1 rounded-lg border border-slate-700 bg-[#0B0F19] px-3 py-2 text-xs text-slate-100"
            />
          </div>
        )}
      </section>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400">
          {t("Memuat koleksi komunitas...", "Loading community hub...")}
        </div>
      ) : category === "tactics" ? (
        <div className="grid gap-4 md:grid-cols-2">
          {tactics.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/community/${item.id}`}
                      className="text-base font-bold text-slate-100 hover:text-emerald-300"
                    >
                      {item.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {t("oleh", "by")} <strong>{item.authorName}</strong> · v{item.gameVersion} ·{" "}
                      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                        {item.playstyleTag}
                      </span>
                    </div>
                  </div>
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                    {item.balanceScore}/100
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-slate-300">
                  {item.description}
                </p>

                <div className="mt-3">
                  <AutoTacticThumbnail tactic={item.tactic} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <UpvoteBookmarkBar
                  entityType="tactic"
                  entityId={item.id}
                  initialUpvotes={item.upvotesCount}
                  initialBookmarks={item.bookmarksCount}
                />

                <div className="flex items-center gap-2">
                  <Link
                    href={`/community/${item.id}`}
                    className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                  >
                    {t("Detail", "Details")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      loadTactic(item.tactic);
                      router.push("/");
                    }}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    {t("Coba di Papan", "Open on Board")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTacticFmf(item)}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    .fmf
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : category === "schedules" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {schedules.map((sched) => (
            <article
              key={sched.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-4"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-100">{sched.title}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t("oleh", "by")} {sched.authorName} · v{sched.gameVersion}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {sched.schedule.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {sched.focusTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                <UpvoteBookmarkBar
                  entityType="schedule"
                  entityId={sched.id}
                  initialUpvotes={sched.upvotesCount}
                  initialBookmarks={sched.bookmarksCount}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loadSchedule(sched.schedule);
                      router.push("/training");
                    }}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-300 cursor-pointer"
                  >
                    {t("Buka di Latihan", "Open Schedule")}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const bytes = await exportScheduleFmfInWorker(sched.schedule);
                      triggerBrowserDownload(
                        sanitizeFileName(sched.title, ".fmf"),
                        bytes,
                      );
                    }}
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    .fmf
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shortlists.map((sl) => (
            <article
              key={sl.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-4"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-100">{sl.title}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t("oleh", "by")} {sl.authorName} · {sl.wonderkidUids.length} Wonderkids · v
                  {sl.gameVersion}
                </p>
                <p className="mt-2 text-xs text-slate-300">{sl.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
                <UpvoteBookmarkBar
                  entityType="shortlist"
                  entityId={sl.id}
                  initialUpvotes={sl.upvotesCount}
                  initialBookmarks={sl.bookmarksCount}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShortlist(sl.title, sl.wonderkidUids);
                      router.push("/wonderkids");
                    }}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-300 cursor-pointer"
                  >
                    {t("Muat Shortlist", "Load Shortlist")}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const bytes = await exportShortlistFmfInWorker(
                        sl.title,
                        sl.wonderkidUids,
                      );
                      triggerBrowserDownload(
                        sanitizeFileName(sl.title, ".fmf"),
                        bytes,
                      );
                    }}
                    className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 cursor-pointer"
                  >
                    .fmf
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
