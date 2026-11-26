"use client";

import React from "react";
import type { StructuralGapAlert } from "@fm27/fm-engine";
import { localizeTacticalAlert, useLocale } from "@/stores/useLocaleStore";
import { useTacticStore } from "@/stores/useTacticStore";

export interface CoachingFindingsListProps {
  alerts: readonly StructuralGapAlert[];
}

export function CoachingFindingsList({ alerts }: CoachingFindingsListProps) {
  const { setTeamInstruction } = useTacticStore();
  const { locale, t } = useLocale();

  return (
    <section
      aria-label={t("Catatan Taktis", "Tactical Notes")}
      className="tactical-surface rounded-xl p-3.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {t("Catatan Taktis", "Tactical Notes")} ({alerts.length})
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200">
          {t(
            "Struktur formasi sudah rapat dan seimbang.",
            "Team shape looks balanced with no major gaps.",
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
          {alerts.map((alert) => {
            const isCritical = alert.severity === "critical";
            const localized = localizeTacticalAlert(alert, locale);
            return (
              <div
                key={alert.id}
                className={`rounded-lg p-3 border flex flex-col gap-1.5 ${
                  isCritical
                    ? "bg-rose-950/25 border-rose-500/45"
                    : "bg-amber-950/20 border-amber-500/35"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isCritical ? "text-rose-300" : "text-amber-300"
                    }`}
                  >
                    {localized.title}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      isCritical
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-amber-500/20 text-amber-200"
                    }`}
                  >
                    {isCritical ? t("Penting", "Important") : t("Saran", "Tip")}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {localized.detail}
                </p>

                {alert.autoFix && (
                  <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/8 mt-1">
                    <span className="text-[11px] text-emerald-300 truncate">
                      {alert.autoFix.text}
                    </span>
                    <button
                      id={`apply-autofix-${alert.id}`}
                      type="button"
                      onClick={() =>
                        setTeamInstruction(
                          alert.autoFix!.group,
                          alert.autoFix!.toBit,
                          true,
                        )
                      }
                      className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 shrink-0 cursor-pointer"
                    >
                      {t("Terapkan", "Apply")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
