"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SquadAuditResult } from "@fm27/shared-types";
import { useLocale } from "../../stores/useLocaleStore";
import { useTrainingStore } from "../../stores/useTrainingStore";

interface WeakestPositionsCardProps {
  audit: SquadAuditResult;
  onInspectSlot: (slotIndex: number) => void;
}

export function WeakestPositionsCard({
  audit,
  onInspectSlot,
}: WeakestPositionsCardProps) {
  const router = useRouter();
  const { t } = useLocale();
  const setTargetAttributes = useTrainingStore((s) => s.setTargetAttributes);

  const weakestItems = audit.weakestThreeSlotIndices
    .map((idx) => audit.starterAudits[idx])
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  function handleSyncToTraining() {
    if (audit.weakestTeamAttributes.length > 0) {
      setTargetAttributes(audit.weakestTeamAttributes);
    }
    router.push("/training");
  }

  return (
    <section className="rounded-xl border border-rose-500/30 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-rose-300">
            {t("3 Posisi Paling Rawan", "3 Weakest Positions")}
          </h3>
          <span className="text-xs text-slate-400">
            {t("Kecocokan Tim:", "Squad Fit:")}{" "}
            <strong className="font-mono text-emerald-300">
              {audit.overallSquadFit.toFixed(0)}/100
            </strong>
          </span>
        </div>

        {audit.weakestTeamAttributes.length > 0 && (
          <button
            type="button"
            onClick={handleSyncToTraining}
            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 cursor-pointer"
          >
            {t("Latih Atribut Ini", "Train Weak Attributes")} (
            {audit.weakestTeamAttributes
              .slice(0, 3)
              .map((a) => a.replace(/_/g, " "))
              .join(", ")}
            )
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {weakestItems.map((item, rank) => (
          <div
            key={item.slotIndex}
            className="flex flex-col justify-between rounded-lg border border-slate-800 bg-[#0B0F19]/90 p-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-300">
                  #{rank + 1} · {item.inSlot}/{item.outSlot}
                </span>
                <span className="font-mono text-sm font-bold text-rose-300">
                  {item.fitScore.toFixed(0)}
                </span>
              </div>

              <div className="mt-2 text-sm font-semibold text-slate-100">
                {item.playerName}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">
                <span className="text-cyan-300">IP {item.inRoleId}</span> ·{" "}
                <span className="text-amber-300">OOP {item.outRoleId}</span>
              </div>

              {item.keyAttributeGaps.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.keyAttributeGaps.map((g) => (
                    <span
                      key={g.attribute}
                      className="rounded border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                    >
                      {g.attribute.replace(/_/g, " ")}: {g.value}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onInspectSlot(item.slotIndex)}
                className="flex-1 rounded-md bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
              >
                {t("Cari Pengganti", "Find Replacement")}
              </button>
              <Link
                href={`/wonderkids?slot=${item.slotIndex}`}
                className="rounded-md border border-cyan-500/40 px-2.5 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/15"
              >
                Wonderkids
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
