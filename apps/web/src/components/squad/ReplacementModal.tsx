"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rankWonderkidsForSlot } from "@fm27/fm-engine";
import type { SlotAssignment, SlotAuditItem } from "@fm27/shared-types";
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
      aria-label="Instant Replacement Modal"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#111827] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-cyan-300">
              Slot #{auditItem.slotIndex + 1} · {auditItem.inSlot} ({auditItem.inRoleId}) /{" "}
              {auditItem.outSlot} ({auditItem.outRoleId})
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-slate-100">
              Instant Replacement for {auditItem.playerName} (Fit{" "}
              <span className="font-mono text-rose-300">
                {auditItem.fitScore.toFixed(1)}
              </span>
              )
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setTab("internal")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === "internal"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Internal Squad ({auditItem.betterInternalReplacements.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("wonderkids")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === "wonderkids"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Wonderkids Targets ({wonderkidMatches.length})
          </button>
          <Link
            href={`/wonderkids?slot=${auditItem.slotIndex}`}
            className="ml-auto text-xs text-cyan-400 hover:underline"
          >
            Open Full Wonderkids Scout {"->"}
          </Link>
        </div>

        {tab === "internal" ? (
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {auditItem.betterInternalReplacements.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-[#0B0F19] p-4 text-xs text-slate-400">
                No bench or U-21 player in the current squad exceeds{" "}
                <strong>{auditItem.playerName}</strong> on this dual-phase role. Switch to the{" "}
                <button
                  type="button"
                  onClick={() => setTab("wonderkids")}
                  className="text-cyan-300 underline"
                >
                  Wonderkids Targets
                </button>{" "}
                tab for external upgrades.
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
                      Projected Fit:{" "}
                      <span className="text-emerald-300">
                        {cand.projectedFit.toFixed(1)}
                      </span>{" "}
                      (+{cand.fitGain.toFixed(1)} Fit Gain)
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
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Promote to XI
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
                  ? "Unggah file save karier .fm untuk menampilkan target pengganti Wonderkids U-21 asli dari dunia karier Anda (data sample dinonaktifkan)."
                  : "Tidak ada target U-21 eksternal yang cocok pada slot ini dari save .fm aktif."}
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
                          {item.wonderkid.age}yo · {item.wonderkid.club} · PA{" "}
                          {item.wonderkid.paRange}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-400">
                        Role Fit:{" "}
                        <span className="text-cyan-300">
                          {item.roleFitScore.toFixed(1)}
                        </span>{" "}
                        · Value Ratio:{" "}
                        <span className="text-emerald-300">
                          {item.valueRatio.toFixed(1)}
                        </span>{" "}
                        · Est. EUR {item.wonderkid.estimatedPriceEurM.toFixed(1)}M
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleShortlistUid(item.wonderkid.uid)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        inShortlist
                          ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                          : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
                      }`}
                    >
                      {inShortlist ? "Shortlisted" : "+ Shortlist"}
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
