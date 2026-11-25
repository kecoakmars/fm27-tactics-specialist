"use client";

import { create } from "zustand";
import { DEFAULT_PATCH_VERSION, getWonderkidsSeed } from "@fm27/fm-data";
import { parseSquadCsv, parseSquadHtml } from "@fm27/fm-engine";
import type {
  LineupPreference,
  Player,
  PositionKey14,
  SquadAuditResult,
  TacticalPriorities,
  TacticPlanResult,
} from "@fm27/shared-types";
import { useTacticStore } from "./useTacticStore";

/**
 * Builds a balanced 22-player demo club squad from the validated v27.0 Wonderkids Registry
 * (at least 2 GKs + 20 outfielders across all 14 positions) so users can test Squad Audit
 * and Hungarian Auto-Generate immediately without uploading a file first.
 */
export function buildDemoClubSquad(patchVersion = DEFAULT_PATCH_VERSION): Player[] {
  const catalog = getWonderkidsSeed(patchVersion).Wonderkids;
  const buckets: PositionKey14[] = [
    "GK",
    "GK",
    "DL",
    "DL",
    "DC",
    "DC",
    "DC",
    "DR",
    "DR",
    "DM",
    "DM",
    "MC",
    "MC",
    "MC",
    "AML",
    "AML",
    "AMC",
    "AMR",
    "AMR",
    "STC",
    "STC",
    "WBL",
  ];

  const usedUids = new Set<number>();
  const picked: Player[] = [];

  for (const pos of buckets) {
    const match = catalog.find(
      (wk) => !usedUids.has(wk.uid) && wk.positions.includes(pos),
    );
    if (!match) continue;
    usedUids.add(match.uid);
    picked.push({
      uid: match.uid,
      name: match.name,
      age: match.age,
      clubName: match.club,
      nationality: match.nationality,
      leftFoot: match.leftFoot,
      rightFoot: match.rightFoot,
      currentAbility: match.currentAbilityEstimate,
      attributes: match.attributes,
      positions: match.positionFamiliarity,
    });
  }

  return picked;
}

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
  loadDemoSquad: (patchVersion?: string) => void;
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
      sourceLabel: `${fileName} (${parsed.length} players)`,
      lineupPreferences: [],
      generatedPlans: [],
      auditResult: null,
      errorMessage: null,
    });
    useTacticStore.getState().syncClubData({ players: parsed });
    return parsed.length;
  },

  loadDemoSquad: (patchVersion = DEFAULT_PATCH_VERSION) => {
    const demo = buildDemoClubSquad(patchVersion);
    set({
      players: demo,
      sourceLabel: `Demo U-21 Elite Squad (${demo.length} players)`,
      lineupPreferences: [],
      generatedPlans: [],
      auditResult: null,
      errorMessage: null,
    });
    useTacticStore.getState().syncClubData({ players: demo });
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
          errorMessage: "Maximum 11 starters can be locked simultaneously.",
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
