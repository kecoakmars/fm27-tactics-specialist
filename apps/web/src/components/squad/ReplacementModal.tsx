"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rankWonderkidsForSlot } from "@fm27/fm-engine";
import type { SlotAssignment, SlotAuditItem } from "@fm27/shared-types";
import { useLocale } from "../../stores/useLocaleStore";
import { useTacticStore } from "../../stores/useTacticStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

interface ReplacementModalProps {
  auditItem: SlotAuditItem;
  slotAssignment: SlotAssignment;
  styleId?: string;
  patchVersion: string;
  onClose: () => void;
  onSwapInternalStarter: (
    slotIndex: number,
    playerUid: number,
    playerName: string,
  ) => void;
}

export function ReplacementModal({
  auditItem,
  slotAssignment,
  styleId,
  patchVersion,
  onClose,
  onSwapInternalStarter,
}: ReplacementModalProps) {
  const { t } = useLocale();
  const [tab, setTab] = useState<"internal" | "wonderkids">("internal");
  const worldWonderkids = useTacticStore((s) => s.worldWonderkids);
  const clubPlayers = useTacticStore((s) => s.clubPlayers);
  const shortlistUids = useTrainingStore((s) => s.shortlistUids);
  const toggleShortlistUid = useTrainingStore((s) => s.toggleShortlistUid);

  const wonderkidMatches = useMemo(() => {
    if (worldWonderkids.length === 0) return [];
    const squadUidSet = new Set(clubPlayers.map((p) => p.uid));
    const liveExternalPool = worldWonderkids.filter((wk) => !squadUidSet.has(wk.uid));
    return rankWonderkidsForSlot(
      slotAssignment,
      {
        styleId,
        patchVersion,
        limit: 8,
      },
      liveExternalPool,
    );
  }, [clubPlayers, patchVersion, slotAssignment, styleId, worldWonderkids]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("Opsi Pengganti", "Replacement Options")}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#111827] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-cyan-300">
              {auditItem.inSlot} ({auditItem.inRoleId}) / {auditItem.outSlot} (
              {auditItem.outRoleId})
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-slate-100">
              {t("Opsi Pengganti", "Replacement for")} {auditItem.playerName} (
              <span className="font-mono text-rose-300">
                {auditItem.fitScore.toFixed(0)}
              </span>
              )
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {t("Tutup", "Close")}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setTab("internal")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
              tab === "internal"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t("Pemain Klub", "Club Squad")} ({auditItem.betterInternalReplacements.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("wonderkids")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
              tab === "wonderkids"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Wonderkids ({wonderkidMatches.length})
          </button>
          <Link
            href={`/wonderkids?slot=${auditItem.slotIndex}`}
            className="ml-auto text-xs text-cyan-400 hover:underline"
          >
            {t("Lihat Semua Wonderkids →", "All Wonderkids →")}
          </Link>
        </div>

        {tab === "internal" ? (
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {auditItem.betterInternalReplacements.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-[#0B0F19] p-4 text-xs text-slate-400">
                {t(
                  `Belum ada pemain cadangan di skuad yang melebihi ${auditItem.playerName} di posisi ini.`,
                  `No bench player in your squad currently outperforms ${auditItem.playerName} in this role.`,
                )}
              </p>
            ) : (
              auditItem.betterInternalReplacements.map((cand) => (
                <div
                  key={cand.playerUid}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {cand.playerName}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {t("Kecocokan:", "Fit:")}{" "}
                      <span className="text-emerald-300">
                        {cand.projectedFit.toFixed(0)}
                      </span>{" "}
                      (+{cand.fitGain.toFixed(0)})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSwapInternalStarter(
                        auditItem.slotIndex,
                        cand.playerUid,
                        cand.playerName,
                      );
                      onClose();
                    }}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    {t("Pasang di XI", "Start in XI")}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {wonderkidMatches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 bg-[#0B0F19] p-4 text-xs text-slate-400">
                {worldWonderkids.length === 0
                  ? t(
                      "Muat save karier (.fm) untuk melihat target wonderkid U-21.",
                      "Load a career save (.fm) to view U-21 wonderkid targets.",
                    )
                  : t(
                      "Tidak ada target U-21 yang cocok di posisi ini.",
                      "No matching U-21 targets found for this position.",
                    )}
              </p>
            ) : (
              wonderkidMatches.map((item) => {
                const inShortlist = shortlistUids.includes(item.wonderkid.uid);
                return (
                  <div
                    key={item.wonderkid.uid}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#0B0F19] p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {item.wonderkid.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {item.wonderkid.age} · {item.wonderkid.club} · PA{" "}
                          {item.wonderkid.paRange}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-400">
                        {t("Kecocokan:", "Fit:")}{" "}
                        <span className="text-cyan-300">
                          {item.roleFitScore.toFixed(0)}
                        </span>{" "}
                        · €{item.wonderkid.estimatedPriceEurM.toFixed(1)}M
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleShortlistUid(item.wonderkid.uid)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        inShortlist
                          ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                          : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                      }`}
                    >
                      {inShortlist ? "✓ Shortlist" : "+ Shortlist"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
