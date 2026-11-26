"use client";

import { create } from "zustand";
import { DEFAULT_PATCH_VERSION, getTrainingPresets } from "@fm27/fm-data";
import { evaluateWeeklyScheduleLoad, type UnifiedReport } from "@fm27/fm-engine";
import type {
  AttributeName,
  LoadMetrics,
  WeeklySchedule,
} from "@fm27/shared-types";

export type SlotColumnKey = "s1" | "s2" | "extra";
export type TrainingUnitScope =
  | "all"
  | "attacking"
  | "midfield"
  | "defending"
  | "goalkeeping";

function getInitialSchedule(patchVersion = DEFAULT_PATCH_VERSION): WeeklySchedule {
  const presets = getTrainingPresets(patchVersion).Presets;
  const base = presets[1] ?? presets[0]!;
  return {
    ...base,
    days: base.days.map((d) => ({ ...d })),
  };
}

export interface TrainingStoreState {
  schedule: WeeklySchedule;
  loadMetrics: LoadMetrics;
  targetAttributes: AttributeName[];
  unitScope: TrainingUnitScope;
  shortlistTitle: string;
  shortlistUids: number[];
  isManuallyEdited: boolean;
  syncedTacticTitle: string | null;

  setSlotSession: (dayIndex: number, slot: SlotColumnKey, sessionCode: string) => void;
  swapSlots: (
    fromDayIndex: number,
    fromSlot: SlotColumnKey,
    toDayIndex: number,
    toSlot: SlotColumnKey,
  ) => void;
  applyPreset: (presetId: string, patchVersion?: string) => void;
  loadSchedule: (schedule: WeeklySchedule, options?: { fromAutoSync?: boolean; syncedTacticTitle?: string | null }) => void;
  syncFromUnifiedReport: (report: UnifiedReport, force?: boolean) => boolean;
  setScheduleMeta: (meta: { name?: string; description?: string }) => void;

  setTargetAttributes: (attrs: AttributeName[]) => void;
  toggleTargetAttribute: (attr: AttributeName) => void;
  setUnitScope: (scope: TrainingUnitScope) => void;

  toggleShortlistUid: (uid: number) => void;
  setShortlist: (title: string, uids: number[]) => void;
  setShortlistTitle: (title: string) => void;
  clearShortlist: () => void;
}

const initialSchedule = getInitialSchedule();

export const useTrainingStore = create<TrainingStoreState>((set) => ({
  schedule: initialSchedule,
  loadMetrics: evaluateWeeklyScheduleLoad(initialSchedule),
  targetAttributes: [
    "passing",
    "decisions",
    "anticipation",
    "acceleration",
    "stamina",
    "composure",
  ],
  unitScope: "all",
  shortlistTitle: "FM27 Tactical Targets",
  shortlistUids: [],
  isManuallyEdited: false,
  syncedTacticTitle: null,

  setSlotSession: (dayIndex, slot, sessionCode) =>
    set((state) => {
      const nextDays = state.schedule.days.map((d, idx) =>
        idx === dayIndex ? { ...d, [slot]: sessionCode } : d,
      );
      const nextSchedule: WeeklySchedule = { ...state.schedule, days: nextDays };
      return {
        schedule: nextSchedule,
        loadMetrics: evaluateWeeklyScheduleLoad(nextSchedule),
        isManuallyEdited: true,
      };
    }),

  swapSlots: (fromDayIndex, fromSlot, toDayIndex, toSlot) =>
    set((state) => {
      if (fromDayIndex === toDayIndex && fromSlot === toSlot) return state;
      const nextDays = state.schedule.days.map((d) => ({ ...d }));
      const sourceDay = nextDays[fromDayIndex];
      const targetDay = nextDays[toDayIndex];
      if (!sourceDay || !targetDay) return state;

      const tmp = sourceDay[fromSlot];
      sourceDay[fromSlot] = targetDay[toSlot];
      targetDay[toSlot] = tmp;

      const nextSchedule: WeeklySchedule = { ...state.schedule, days: nextDays };
      return {
        schedule: nextSchedule,
        loadMetrics: evaluateWeeklyScheduleLoad(nextSchedule),
        isManuallyEdited: true,
      };
    }),

  applyPreset: (presetId, patchVersion = DEFAULT_PATCH_VERSION) =>
    set(() => {
      const presets = getTrainingPresets(patchVersion).Presets;
      const match = presets.find((p) => p.id === presetId) ?? presets[0]!;
      const cloned: WeeklySchedule = {
        ...match,
        days: match.days.map((d) => ({ ...d })),
      };
      return {
        schedule: cloned,
        loadMetrics: evaluateWeeklyScheduleLoad(cloned),
        isManuallyEdited: true,
        syncedTacticTitle: null,
      };
    }),

  loadSchedule: (schedule, options) =>
    set(() => ({
      schedule,
      loadMetrics: evaluateWeeklyScheduleLoad(schedule),
      isManuallyEdited: !options?.fromAutoSync,
      syncedTacticTitle: options?.syncedTacticTitle ?? null,
    })),

  syncFromUnifiedReport: (report, force = false) => {
    let applied = false;
    set((state) => {
      if (state.isManuallyEdited && !force) {
        return state;
      }
      applied = true;
      const nextSchedule: WeeklySchedule = {
        ...report.trainingPlan.schedule,
        days: report.trainingPlan.schedule.days.map((d) => ({ ...d })),
      };
      const topAttrs = new Set<AttributeName>();
      for (const unit of ["attacking", "midfield", "defending", "goalkeeping"] as const) {
        for (const item of report.trainingPlan.unitAttributeFrequencies[unit].slice(0, 2)) {
          topAttrs.add(item.attribute);
        }
      }
      return {
        schedule: nextSchedule,
        loadMetrics: evaluateWeeklyScheduleLoad(nextSchedule),
        targetAttributes:
          topAttrs.size > 0 ? Array.from(topAttrs).slice(0, 8) : state.targetAttributes,
        isManuallyEdited: false,
        syncedTacticTitle: report.tacticAdvice.activeTactic.title,
      };
    });
    return applied;
  },

  setScheduleMeta: (meta) =>
    set((state) => ({
      schedule: {
        ...state.schedule,
        ...(meta.name !== undefined ? { name: meta.name } : {}),
        ...(meta.description !== undefined ? { description: meta.description } : {}),
      },
    })),

  setTargetAttributes: (targetAttributes) => set({ targetAttributes }),

  toggleTargetAttribute: (attr) =>
    set((state) => {
      const exists = state.targetAttributes.includes(attr);
      return {
        targetAttributes: exists
          ? state.targetAttributes.filter((a) => a !== attr)
          : [...state.targetAttributes, attr].slice(0, 8),
      };
    }),

  setUnitScope: (unitScope) => set({ unitScope }),

  toggleShortlistUid: (uid) =>
    set((state) => ({
      shortlistUids: state.shortlistUids.includes(uid)
        ? state.shortlistUids.filter((id) => id !== uid)
        : [...state.shortlistUids, uid],
    })),

  setShortlist: (shortlistTitle, uids) =>
    set({
      shortlistTitle,
      shortlistUids: Array.from(new Set(uids.filter((u) => Number.isInteger(u) && u > 0))),
    }),

  setShortlistTitle: (shortlistTitle) => set({ shortlistTitle }),

  clearShortlist: () => set({ shortlistUids: [] }),
}));
