"use client";

import { getTrainingSessions } from "@fm27/fm-data";
import type { LoadMetrics, WeeklySchedule } from "@fm27/shared-types";
import type { SlotColumnKey } from "../../stores/useTrainingStore";

interface WeeklyScheduleGridProps {
  schedule: WeeklySchedule;
  metrics: LoadMetrics;
  patchVersion: string;
  activeBrushCode: string | null;
  onAssignSlot: (dayIndex: number, slot: SlotColumnKey, code: string) => void;
  onSwapSlots: (
    fromDayIndex: number,
    fromSlot: SlotColumnKey,
    toDayIndex: number,
    toSlot: SlotColumnKey,
  ) => void;
}

const SLOT_COLUMNS: Array<{ key: SlotColumnKey; label: string }> = [
  { key: "s1", label: "Session 1 (Morning)" },
  { key: "s2", label: "Session 2 (Afternoon)" },
  { key: "extra", label: "Extra Slot" },
];

const CATEGORY_BADGE: Record<string, string> = {
  attacking: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  defending: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  possession: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  tactical: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
  physical: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  goalkeeping: "border-purple-500/40 bg-purple-500/10 text-purple-200",
  match_prep: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  set_pieces: "border-teal-500/40 bg-teal-500/10 text-teal-200",
  general: "border-slate-600 bg-slate-800/70 text-slate-200",
  rest: "border-slate-800 bg-[#0B0F19] text-slate-400",
};

export function WeeklyScheduleGrid({
  schedule,
  metrics,
  patchVersion,
  activeBrushCode,
  onAssignSlot,
  onSwapSlots,
}: WeeklyScheduleGridProps) {
  const catalog = getTrainingSessions(patchVersion);
  const byCode = new Map(catalog.Sessions.map((s) => [s.code, s]));
  const violatedSet = new Set(metrics.violations.map((v) => v.code));

  return (
    <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Interactive 7 Days x 3 Slots Schedule Grid
          </h3>
          <p className="text-xs text-slate-400">
            {activeBrushCode ? (
              <>
                Paint Brush Active:{" "}
                <strong className="font-mono text-emerald-300">
                  {activeBrushCode}
                </strong>{" "}
                (click any slot to apply)
              </>
            ) : (
              "Drag cells to swap sessions, drop from palette, or change any dropdown directly."
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[680px] space-y-2">
          <div className="grid grid-cols-[72px_1fr_1fr_1fr] gap-2 px-1 text-[11px] font-semibold uppercase text-slate-400">
            <div>Day</div>
            {SLOT_COLUMNS.map((col) => (
              <div key={col.key}>{col.label}</div>
            ))}
          </div>

          {schedule.days.map((dayRow, dayIdx) => (
            <div
              key={dayRow.day}
              className="grid grid-cols-[72px_1fr_1fr_1fr] items-stretch gap-2"
            >
              <div className="flex items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] font-mono text-xs font-bold text-slate-200">
                {dayRow.day}
              </div>

              {SLOT_COLUMNS.map((col) => {
                const code = dayRow[col.key];
                const session = byCode.get(code);
                const catStyle =
                  CATEGORY_BADGE[session?.category ?? "rest"] ??
                  CATEGORY_BADGE.rest;
                const isViolated = violatedSet.has(code);

                return (
                  <div
                    key={col.key}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/x-fm27-grid-cell",
                        JSON.stringify({ dayIdx, slot: col.key }),
                      );
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const paletteCode = e.dataTransfer.getData(
                        "application/x-fm27-session",
                      );
                      if (paletteCode) {
                        onAssignSlot(dayIdx, col.key, paletteCode);
                        return;
                      }
                      const rawCell = e.dataTransfer.getData(
                        "application/x-fm27-grid-cell",
                      );
                      if (rawCell) {
                        try {
                          const parsed = JSON.parse(rawCell) as {
                            dayIdx: number;
                            slot: SlotColumnKey;
                          };
                          onSwapSlots(parsed.dayIdx, parsed.slot, dayIdx, col.key);
                        } catch {
                          // ignore malformed drag payload
                        }
                      }
                    }}
                    onClick={() => {
                      if (activeBrushCode) {
                        onAssignSlot(dayIdx, col.key, activeBrushCode);
                      }
                    }}
                    className={`rounded-lg border p-2 transition ${
                      isViolated
                        ? "border-rose-500 bg-rose-500/15"
                        : catStyle
                    } ${activeBrushCode ? "cursor-pointer" : "cursor-grab"}`}
                  >
                    <select
                      value={code}
                      aria-label={`${dayRow.day} ${col.label}`}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onAssignSlot(dayIdx, col.key, e.target.value)
                      }
                      className="w-full bg-transparent text-xs font-medium text-slate-100 focus:outline-none"
                    >
                      {catalog.Sessions.map((s) => (
                        <option
                          key={s.code}
                          value={s.code}
                          className="bg-[#0B0F19] text-slate-100"
                        >
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {session && (
                      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>{session.category}</span>
                        <span>
                          Cond {session.impact.condition >= 0 ? "+" : ""}
                          {session.impact.condition}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
