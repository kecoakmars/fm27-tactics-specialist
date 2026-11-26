"use client";

import { create } from "zustand";
import { parseSquadCsv, parseSquadHtml } from "@fm27/fm-engine";
import type {
  LineupPreference,
  Player,
  SquadAuditResult,
  TacticalPriorities,
  TacticPlanResult,
} from "@fm27/shared-types";
import { useTacticStore } from "./useTacticStore";

export interface SquadStoreState {
  players: Player[];
  sourceLabel: string | null;
  lineupPreferences: LineupPreference[];
  priorities: TacticalPriorities;
  styleFilter: string;
  generatedPlans: TacticPlanResult[];
  auditResult: SquadAuditResult | null;
  isBusy: boolean;
  errorMessage: string | null;

  importFromText: (rawText: string, fileName: string) => number;
  setSquadFromSave: (players: Player[], sourceLabel: string) => void;
  clearSquad: () => void;

  toggleMustStart: (playerUid: number) => void;
  setPlayerSlotLock: (
    playerUid: number,
    phase: "ip" | "oop",
    slotId: string,
  ) => void;
  clearLineupPreferences: () => void;

  setObjective: (objective: TacticalPriorities["objective"]) => void;
  setRiskOffset: (riskOffset: number) => void;
  togglePriorityStyle: (styleId: string) => void;
  setStyleFilter: (styleId: string) => void;

  setGeneratedPlans: (plans: TacticPlanResult[]) => void;
  setAuditResult: (audit: SquadAuditResult | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSquadStore = create<SquadStoreState>((set) => ({
  players: [],
  sourceLabel: null,
  lineupPreferences: [],
  priorities: {
    selectedStyleIds: [],
    objective: "Balanced",
    riskOffset: 0,
  },
  styleFilter: "",
  generatedPlans: [],
  auditResult: null,
  isBusy: false,
  errorMessage: null,

  importFromText: (rawText, fileName) => {
    const trimmed = rawText.trim();
    const isHtml =
      fileName.toLowerCase().endsWith(".html") ||
      fileName.toLowerCase().endsWith(".htm") ||
      /<table\b/i.test(trimmed);

    const parsed = isHtml ? parseSquadHtml(rawText) : parseSquadCsv(rawText);
    set({
      players: parsed,
      sourceLabel: `${fileName} (${parsed.length} pemain)`,
      lineupPreferences: [],
      generatedPlans: [],
      auditResult: null,
      errorMessage: null,
    });
    useTacticStore.getState().syncClubData({ players: parsed });
    return parsed.length;
  },

  setSquadFromSave: (players, sourceLabel) => {
    set({
      players: players.map((p) => ({ ...p })),
      sourceLabel,
      lineupPreferences: [],
      generatedPlans: [],
      auditResult: null,
      errorMessage: null,
    });
  },

  clearSquad: () => {
    set({
      players: [],
      sourceLabel: null,
      lineupPreferences: [],
      generatedPlans: [],
      auditResult: null,
      errorMessage: null,
    });
    useTacticStore.getState().syncClubData({ players: [] });
  },

  toggleMustStart: (playerUid) =>
    set((state) => {
      const existing = state.lineupPreferences.find((lp) => lp.playerUid === playerUid);
      if (existing) {
        return {
          lineupPreferences: state.lineupPreferences.filter(
            (lp) => lp.playerUid !== playerUid,
          ),
        };
      }
      if (state.lineupPreferences.filter((lp) => lp.mustStart).length >= 11) {
        return {
          errorMessage: "Maksimal 11 starter dapat dikunci secara bersamaan.",
        };
      }
      return {
        lineupPreferences: [
          ...state.lineupPreferences,
          { playerUid, mustStart: true },
        ],
        errorMessage: null,
      };
    }),

  setPlayerSlotLock: (playerUid, phase, slotId) =>
    set((state) => {
      const existing = state.lineupPreferences.find((lp) => lp.playerUid === playerUid);
      const cleanSlot = slotId || undefined;
      if (!existing) {
        return {
          lineupPreferences: [
            ...state.lineupPreferences,
            {
              playerUid,
              mustStart: true,
              ...(phase === "ip"
                ? { lockedInSlot: cleanSlot }
                : { lockedOutSlot: cleanSlot }),
            },
          ],
        };
      }
      return {
        lineupPreferences: state.lineupPreferences.map((lp) =>
          lp.playerUid === playerUid
            ? {
                ...lp,
                ...(phase === "ip"
                  ? { lockedInSlot: cleanSlot }
                  : { lockedOutSlot: cleanSlot }),
              }
            : lp,
        ),
      };
    }),

  clearLineupPreferences: () => set({ lineupPreferences: [] }),

  setObjective: (objective) =>
    set((state) => ({
      priorities: { ...state.priorities, objective },
    })),

  setRiskOffset: (riskOffset) =>
    set((state) => ({
      priorities: {
        ...state.priorities,
        riskOffset: Math.max(-2, Math.min(2, Math.trunc(riskOffset))),
      },
    })),

  togglePriorityStyle: (styleId) =>
    set((state) => {
      const current = state.priorities.selectedStyleIds;
      const next = current.includes(styleId)
        ? current.filter((id) => id !== styleId)
        : [...current, styleId].slice(0, 3);
      return {
        priorities: { ...state.priorities, selectedStyleIds: next },
      };
    }),

  setStyleFilter: (styleFilter) => set({ styleFilter }),
  setGeneratedPlans: (generatedPlans) => set({ generatedPlans }),
  setAuditResult: (auditResult) => set({ auditResult }),
  setBusy: (isBusy) => set({ isBusy }),
  setError: (errorMessage) => set({ errorMessage }),
}));
