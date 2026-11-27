"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import type { FmSaveClubEntry, ParsedFmSave } from "@fm27/fm-codec";
import {
  DEFAULT_PATCH_VERSION,
  getPatchData,
  getPitchCatalog,
  getTacticalStyles,
  migrateTacticToPatch,
} from "@fm27/fm-data";
import {
  analyzeSquadAndGenerateTactics,
  analyzeUnified,
  computeEffectivePlayerInstructionBits,
  detectFormation,
  getCandidateRolesForSlot,
  gradeImportedTactic,
  inferDutyForRole,
  resolveTeamInstructionConflicts,
  type UnifiedReport,
} from "@fm27/fm-engine";
import type {
  AttributeName,
  DualPhaseTactic,
  Duty,
  Player,
  SlotAssignment,
  StaffMember,
  Wonderkid,
} from "@fm27/shared-types";
import { analyzeUnifiedInWorker } from "../lib/worker-client";
import { useSquadStore } from "./useSquadStore";
import { useTrainingStore } from "./useTrainingStore";

export type PitchViewMode = "ip" | "oop" | "split";

export interface FmImportProgressState {
  stage: string;
  pct: number;
  fileName: string;
}

export function buildPresetTactic(
  styleId = "Gegenpress",
  shapeId?: string,
  patchVersion = DEFAULT_PATCH_VERSION,
): DualPhaseTactic {
  const catalog = getPitchCatalog(patchVersion);
  const stylesCatalog = getTacticalStyles(patchVersion);
  const style =
    stylesCatalog.TacticalStyles.find((s) => s.Id === styleId) ??
    stylesCatalog.TacticalStyles[0]!;

  const preferredShapeId = shapeId ?? style.Allows[0];
  const shape =
    stylesCatalog.StyleShapes.find((sh) => sh.Id === preferredShapeId) ??
    stylesCatalog.Shapes[0]!;

  const preferredRoleSet = new Set(style.PreferredRoles ?? []);

  const slots: SlotAssignment[] = shape.InSlots.map((inPos, idx) => {
    const outPos = shape.OutSlots[idx]!;
    const ipCandidates = getCandidateRolesForSlot(inPos, 0, shape.InSlots, patchVersion);
    const oopCandidates = getCandidateRolesForSlot(outPos, 1, shape.OutSlots, patchVersion);

    const chosenIp =
      ipCandidates.find((r) => preferredRoleSet.has(r.Id)) ??
      ipCandidates[ipCandidates.length - 1]!;
    const chosenOop =
      oopCandidates.find((r) => preferredRoleSet.has(r.Id)) ??
      oopCandidates[0]!;

    return {
      slotIndex: idx,
      inPossession: {
        positionId: inPos,
        roleId: chosenIp.Id,
        duty: inferDutyForRole(chosenIp.Id, 0),
        playerInstructionBits: computeEffectivePlayerInstructionBits(
          catalog.PlayerInstructionPolicies,
          0,
          inPos,
          chosenIp.Id,
          [],
        ),
        markingPositionMask: 0,
      },
      outOfPossession: {
        positionId: outPos,
        roleId: chosenOop.Id,
        duty: "Defend",
        playerInstructionBits: computeEffectivePlayerInstructionBits(
          catalog.PlayerInstructionPolicies,
          1,
          outPos,
          chosenOop.Id,
          [],
        ),
        markingPositionMask: 0,
      },
    };
  });

  return {
    title: `${style.Name} ${shape.InPossessionName}`,
    description: `${style.Name} dual-phase system (${shape.InPossessionName} IP -> ${shape.OutOfPossessionName} OOP).`,
    author: "",
    patchVersion,
    styleId: style.Id,
    mentality: style.Mentality,
    inFormation: detectFormation(shape.InSlots, { catalog }),
    outFormation: detectFormation(shape.OutSlots, { catalog }),
    teamInstructions: resolveTeamInstructionConflicts(
      { LineOfEngagement: 62, ...style.InstructionBits },
      catalog,
    ),
    slots,
  };
}

function normalizeLoadedTactic(tactic: DualPhaseTactic): DualPhaseTactic {
  const catalog = getPitchCatalog(tactic.patchVersion);
  const clonedSlots: SlotAssignment[] = tactic.slots.map((s, idx) => ({
    ...s,
    slotIndex: idx,
    inPossession: {
      ...s.inPossession,
      playerInstructionBits: [...s.inPossession.playerInstructionBits],
    },
    outOfPossession: {
      ...s.outOfPossession,
      playerInstructionBits: [...s.outOfPossession.playerInstructionBits],
    },
  }));
  return {
    ...tactic,
    inFormation:
      detectFormation(
        clonedSlots.map((s) => s.inPossession.positionId),
        { catalog },
      ) || tactic.inFormation,
    outFormation:
      detectFormation(
        clonedSlots.map((s) => s.outOfPossession.positionId),
        { catalog },
      ) || tactic.outFormation,
    teamInstructions: { ...tactic.teamInstructions },
    slots: clonedSlots,
  };
}

function computeUnifiedSafe(params: {
  tactic: DualPhaseTactic | null;
  clubPlayers: readonly Player[];
  clubStaff: readonly StaffMember[];
  worldWonderkids: readonly Wonderkid[];
  worldStaffPool: readonly StaffMember[];
  patchVersion: string;
}): UnifiedReport {
  const dataset = getPatchData(params.patchVersion);
  return analyzeUnified({
    tactic: params.tactic,
    squad: params.clubPlayers.length >= 11 ? params.clubPlayers : null,
    clubStaff: params.clubStaff.length > 0 ? params.clubStaff : null,
    worldWonderkids: params.worldWonderkids.length > 0 ? params.worldWonderkids : null,
    worldStaffPool: params.worldStaffPool.length > 0 ? params.worldStaffPool : null,
    dataset,
  });
}

export interface GlobalToastNotice {
  tone: "ok" | "error";
  text: string;
}

function syncDependentStoresFromReport(report: UnifiedReport): void {
  useTrainingStore.getState().syncFromUnifiedReport(report, false);
  if (report.squadBlueprintOrAudit.audit) {
    useSquadStore.getState().setAuditResult(report.squadBlueprintOrAudit.audit);
  }
}

function buildSquadAwarePresetTactic(
  styleId: string,
  shapeId: string | undefined,
  patchVersion: string,
  clubPlayers: readonly Player[],
): DualPhaseTactic {
  const basePreset = buildPresetTactic(styleId, shapeId, patchVersion);
  if (clubPlayers.length < 11) {
    return basePreset;
  }

  try {
    const stylesCatalog = getTacticalStyles(patchVersion);
    const targetShape = shapeId
      ? stylesCatalog.StyleShapes.find((sh) => sh.Id === shapeId)
      : undefined;

    const plans = analyzeSquadAndGenerateTactics(clubPlayers, {
      styleId,
      patchVersion,
    });

    if (!targetShape && plans.length > 0) {
      return normalizeLoadedTactic(plans[0]!.tactic);
    }

    if (targetShape) {
      const matched = plans.find(
        (p) =>
          p.tactic.inFormation === targetShape.InPossessionName &&
          p.tactic.outFormation === targetShape.OutOfPossessionName,
      );
      if (matched) {
        return normalizeLoadedTactic(matched.tactic);
      }
      const graded = gradeImportedTactic(basePreset, clubPlayers, {
        improve: true,
        patchVersion,
      });
      return normalizeLoadedTactic(graded.tactic);
    }
  } catch {
    // Fallback to clean preset if squad lacks GK/outfielders
  }

  return basePreset;
}

export interface TacticStoreState {
  tactic: DualPhaseTactic;
  hasExplicitTactic: boolean;
  hasUserImportedTactic: boolean;
  clubPlayers: Player[];
  clubStaff: StaffMember[];
  worldWonderkids: Wonderkid[];
  worldStaffPool: StaffMember[];
  liveFmSave: ParsedFmSave | null;
  selectedClubUid: number | null;
  clubPickerOpen: boolean;
  fmImportProgress: FmImportProgressState | null;
  unifiedReport: UnifiedReport | null;
  unifiedReportMinimized: boolean;
  globalNotice: GlobalToastNotice | null;

  viewMode: PitchViewMode;
  showTransitionVectors: boolean;
  selectedSlotIndex: number | null;
  hoveredSlotIndex: number | null;
  playerModalOpen: boolean;

  setViewMode: (mode: PitchViewMode) => void;
  setShowTransitionVectors: (show: boolean) => void;
  selectSlot: (slotIndex: number | null, openModal?: boolean) => void;
  hoverSlot: (slotIndex: number | null) => void;
  setPlayerModalOpen: (open: boolean) => void;
  setClubPickerOpen: (open: boolean) => void;
  setFmImportProgress: (progress: FmImportProgressState | null) => void;
  setGlobalNotice: (notice: GlobalToastNotice | null) => void;

  setTitle: (title: string) => void;
  setMetadata: (meta: { description?: string; author?: string }) => void;
  setPatchVersion: (patchVersion: string) => void;
  setMentality: (mentality: number) => void;
  setTeamInstruction: (group: string, bit: number, autoResolve?: boolean) => void;
  resolveAllConflicts: () => void;

  moveSlotToPosition: (
    slotIndex: number,
    phase: "ip" | "oop",
    targetPositionId: string,
  ) => void;
  setSlotRole: (slotIndex: number, phase: "ip" | "oop", roleId: string) => void;
  setSlotDuty: (slotIndex: number, duty: Duty) => void;
  setSlotPlayerInstructionGroupBit: (
    slotIndex: number,
    phase: "ip" | "oop",
    groupNonZeroBits: readonly number[],
    selectedBit: number,
  ) => void;

  applyPresetStyle: (styleId: string, shapeId?: string) => void;
  applyDualShape: (shapeId: string) => void;
  assignPlayerToSlot: (
    slotIndex: number,
    playerUid: number | undefined,
    playerName?: string,
  ) => void;
  loadTactic: (tactic: DualPhaseTactic, options?: { fromUserTactic?: boolean }) => void;

  syncClubData: (data: {
    players?: Player[];
    staff?: StaffMember[];
    preferModeB?: boolean;
  }) => void;
  ingestParsedFmSave: (
    parsed: ParsedFmSave,
    fileName: string,
  ) => Promise<{
    selectedClub: FmSaveClubEntry | null;
    report: UnifiedReport | null;
  }>;
  selectClubFromFmSave: (clubUid: number) => Promise<{
    selectedClub: FmSaveClubEntry;
    report: UnifiedReport;
  }>;
  solveBestTacticForCurrentClub: () => Promise<UnifiedReport | null>;
  clearFmSaveSession: () => void;
  refreshUnifiedReport: () => void;
  dismissUnifiedReport: () => void;
  setUnifiedReportMinimized: (minimized: boolean) => void;
  toggleUnifiedReportMinimized: () => void;
  pushTrainingPlanToStore: () => boolean;
}

export const useTacticStore = create<TacticStoreState>()(
  temporal(
    (set, get) => ({
      tactic: buildPresetTactic("Gegenpress", "shape-03-433-4141"),
      hasExplicitTactic: false,
      hasUserImportedTactic: false,
      clubPlayers: [],
      clubStaff: [],
      worldWonderkids: [],
      worldStaffPool: [],
      liveFmSave: null,
      selectedClubUid: null,
      clubPickerOpen: false,
      fmImportProgress: null,
      unifiedReport: null,
      unifiedReportMinimized: false,
      globalNotice: null,

      viewMode: "split",
      showTransitionVectors: true,
      selectedSlotIndex: 0,
      hoveredSlotIndex: null,
      playerModalOpen: false,

      setViewMode: (viewMode) => set({ viewMode }),
      setShowTransitionVectors: (showTransitionVectors) => set({ showTransitionVectors }),
      selectSlot: (selectedSlotIndex, openModal = false) =>
        set((state) => ({
          selectedSlotIndex,
          playerModalOpen: openModal ? true : state.playerModalOpen,
        })),
      hoverSlot: (hoveredSlotIndex) => set({ hoveredSlotIndex }),
      setPlayerModalOpen: (playerModalOpen) => set({ playerModalOpen }),
      setClubPickerOpen: (clubPickerOpen) => set({ clubPickerOpen }),
      setFmImportProgress: (fmImportProgress) => set({ fmImportProgress }),
      setGlobalNotice: (globalNotice) => set({ globalNotice }),

      setTitle: (title) =>
        set((state) => ({
          tactic: { ...state.tactic, title },
        })),

      setMetadata: (meta) =>
        set((state) => ({
          tactic: {
            ...state.tactic,
            ...(meta.description !== undefined ? { description: meta.description } : {}),
            ...(meta.author !== undefined ? { author: meta.author } : {}),
          },
        })),

      setPatchVersion: (patchVersion) =>
        set((state) => {
          const nextTactic = migrateTacticToPatch(state.tactic, patchVersion);
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      setMentality: (mentality) =>
        set((state) => {
          const nextTactic: DualPhaseTactic = {
            ...state.tactic,
            mentality: Math.max(1, Math.min(7, mentality)),
          };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      setTeamInstruction: (group, bit, autoResolve = false) =>
        set((state) => {
          const nextTi = { ...state.tactic.teamInstructions, [group]: bit };
          const catalog = getPitchCatalog(state.tactic.patchVersion);
          const nextTactic: DualPhaseTactic = {
            ...state.tactic,
            teamInstructions: autoResolve
              ? resolveTeamInstructionConflicts(nextTi, catalog)
              : nextTi,
          };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      resolveAllConflicts: () =>
        set((state) => {
          const catalog = getPitchCatalog(state.tactic.patchVersion);
          const nextTactic: DualPhaseTactic = {
            ...state.tactic,
            teamInstructions: resolveTeamInstructionConflicts(
              state.tactic.teamInstructions,
              catalog,
            ),
          };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      moveSlotToPosition: (slotIndex, phase, targetPositionId) =>
        set((state) => {
          const { tactic } = state;
          const catalog = getPitchCatalog(tactic.patchVersion);
          const currentSlot = tactic.slots[slotIndex];
          if (!currentSlot) return state;

          const currentPosId =
            phase === "ip"
              ? currentSlot.inPossession.positionId
              : currentSlot.outOfPossession.positionId;

          if (currentPosId === targetPositionId) return state;
          if ((currentPosId === "GK") !== (targetPositionId === "GK")) return state;

          const phaseNum = phase === "ip" ? 0 : 1;
          const occupyingIdx = tactic.slots.findIndex(
            (s, idx) =>
              idx !== slotIndex &&
              (phase === "ip"
                ? s.inPossession.positionId === targetPositionId
                : s.outOfPossession.positionId === targetPositionId),
          );

          const updatedSlots = tactic.slots.map((s) => ({
            ...s,
            inPossession: { ...s.inPossession },
            outOfPossession: { ...s.outOfPossession },
          }));

          if (occupyingIdx >= 0) {
            const other = updatedSlots[occupyingIdx]!;
            if (phase === "ip") {
              updatedSlots[slotIndex]!.inPossession.positionId = targetPositionId;
              other.inPossession.positionId = currentPosId;
            } else {
              updatedSlots[slotIndex]!.outOfPossession.positionId = targetPositionId;
              other.outOfPossession.positionId = currentPosId;
            }
          } else {
            if (phase === "ip") {
              updatedSlots[slotIndex]!.inPossession.positionId = targetPositionId;
            } else {
              updatedSlots[slotIndex]!.outOfPossession.positionId = targetPositionId;
            }
          }

          const nextShapeSlots = updatedSlots.map((s) =>
            phase === "ip" ? s.inPossession.positionId : s.outOfPossession.positionId,
          );

          for (const s of updatedSlots) {
            const cfg = phase === "ip" ? s.inPossession : s.outOfPossession;
            const candidates = getCandidateRolesForSlot(
              cfg.positionId,
              phaseNum,
              nextShapeSlots,
              tactic.patchVersion,
            );
            if (candidates.length > 0 && !candidates.some((c) => c.Id === cfg.roleId)) {
              const fallbackRole = candidates[candidates.length - 1]!;
              cfg.roleId = fallbackRole.Id;
              cfg.duty = inferDutyForRole(fallbackRole.Id, phaseNum);
            }
            cfg.playerInstructionBits = computeEffectivePlayerInstructionBits(
              catalog.PlayerInstructionPolicies,
              phaseNum,
              cfg.positionId,
              cfg.roleId,
              cfg.playerInstructionBits,
            );
          }

          const inFormation = detectFormation(
            updatedSlots.map((s) => s.inPossession.positionId),
            { catalog },
          );
          const outFormation = detectFormation(
            updatedSlots.map((s) => s.outOfPossession.positionId),
            { catalog },
          );

          const nextTactic: DualPhaseTactic = {
            ...tactic,
            inFormation,
            outFormation,
            slots: updatedSlots,
          };

          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      setSlotRole: (slotIndex, phase, roleId) =>
        set((state) => {
          const { tactic } = state;
          const catalog = getPitchCatalog(tactic.patchVersion);
          const phaseNum = phase === "ip" ? 0 : 1;

          const updatedSlots = tactic.slots.map((s, idx) => {
            if (idx !== slotIndex) return s;
            const cfg = phase === "ip" ? s.inPossession : s.outOfPossession;
            const nextCfg = {
              ...cfg,
              roleId,
              duty: phase === "ip" ? inferDutyForRole(roleId, 0) : ("Defend" as const),
              playerInstructionBits: computeEffectivePlayerInstructionBits(
                catalog.PlayerInstructionPolicies,
                phaseNum,
                cfg.positionId,
                roleId,
                cfg.playerInstructionBits,
              ),
            };
            return phase === "ip"
              ? { ...s, inPossession: nextCfg }
              : { ...s, outOfPossession: nextCfg };
          });

          const nextTactic: DualPhaseTactic = { ...tactic, slots: updatedSlots };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      setSlotDuty: (slotIndex, duty) =>
        set((state) => {
          const nextTactic: DualPhaseTactic = {
            ...state.tactic,
            slots: state.tactic.slots.map((s, idx) =>
              idx === slotIndex
                ? { ...s, inPossession: { ...s.inPossession, duty } }
                : s,
            ),
          };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      setSlotPlayerInstructionGroupBit: (slotIndex, phase, groupNonZeroBits, selectedBit) =>
        set((state) => {
          const { tactic } = state;
          const catalog = getPitchCatalog(tactic.patchVersion);
          const phaseNum = phase === "ip" ? 0 : 1;
          const clearSet = new Set(groupNonZeroBits);

          const updatedSlots = tactic.slots.map((s, idx) => {
            if (idx !== slotIndex) return s;
            const cfg = phase === "ip" ? s.inPossession : s.outOfPossession;
            const filtered = cfg.playerInstructionBits.filter((b) => !clearSet.has(b));
            if (selectedBit > 0) filtered.push(selectedBit);

            const effective = computeEffectivePlayerInstructionBits(
              catalog.PlayerInstructionPolicies,
              phaseNum,
              cfg.positionId,
              cfg.roleId,
              filtered,
            );
            const nextCfg = { ...cfg, playerInstructionBits: effective };
            return phase === "ip"
              ? { ...s, inPossession: nextCfg }
              : { ...s, outOfPossession: nextCfg };
          });

          return { tactic: { ...tactic, slots: updatedSlots } };
        }),

      applyPresetStyle: (styleId, shapeId) => {
        let computedReport: UnifiedReport | null = null;
        set((state) => {
          const nextTactic = buildSquadAwarePresetTactic(
            styleId,
            shapeId,
            state.tactic.patchVersion,
            state.clubPlayers,
          );
          computedReport =
            state.unifiedReport || state.clubPlayers.length >= 11
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null;
          return {
            tactic: nextTactic,
            selectedSlotIndex: 0,
            unifiedReport: computedReport,
          };
        });
        if (computedReport) {
          syncDependentStoresFromReport(computedReport);
        }
      },

      applyDualShape: (shapeId) => {
        if (shapeId === "custom") return;
        const currentStyle = get().tactic.styleId ?? "Balanced";
        let computedReport: UnifiedReport | null = null;
        set((state) => {
          const nextTactic = buildSquadAwarePresetTactic(
            currentStyle,
            shapeId,
            state.tactic.patchVersion,
            state.clubPlayers,
          );
          computedReport =
            state.unifiedReport || state.clubPlayers.length >= 11
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null;
          return {
            tactic: nextTactic,
            selectedSlotIndex: 0,
            unifiedReport: computedReport,
          };
        });
        if (computedReport) {
          syncDependentStoresFromReport(computedReport);
        }
      },

      assignPlayerToSlot: (slotIndex, playerUid, playerName) =>
        set((state) => {
          const nextTactic: DualPhaseTactic = {
            ...state.tactic,
            slots: state.tactic.slots.map((s, idx) => {
              if (idx === slotIndex) {
                return { ...s, playerUid, playerName };
              }
              if (playerUid !== undefined && s.playerUid === playerUid) {
                return { ...s, playerUid: undefined, playerName: undefined };
              }
              return s;
            }),
          };
          return {
            tactic: nextTactic,
            unifiedReport: state.unifiedReport
              ? computeUnifiedSafe({
                  tactic: nextTactic,
                  clubPlayers: state.clubPlayers,
                  clubStaff: state.clubStaff,
                  worldWonderkids: state.worldWonderkids,
                  worldStaffPool: state.worldStaffPool,
                  patchVersion: nextTactic.patchVersion,
                })
              : null,
          };
        }),

      loadTactic: (tactic, options) => {
        let computedReport: UnifiedReport | null = null;
        set((state) => {
          const normalizedTactic = normalizeLoadedTactic(tactic);
          const unifiedReport = computeUnifiedSafe({
            tactic: normalizedTactic,
            clubPlayers: state.clubPlayers,
            clubStaff: state.clubStaff,
            worldWonderkids: state.worldWonderkids,
            worldStaffPool: state.worldStaffPool,
            patchVersion: normalizedTactic.patchVersion,
          });
          computedReport = unifiedReport;

          const hasNoAssignedPlayers = normalizedTactic.slots.every((s) => !s.playerUid);
          const boardTactic =
            hasNoAssignedPlayers && state.clubPlayers.length >= 11
              ? normalizeLoadedTactic(unifiedReport.tacticAdvice.activeTactic)
              : normalizedTactic;

          return {
            tactic: boardTactic,
            hasExplicitTactic: true,
            hasUserImportedTactic:
              options?.fromUserTactic !== undefined
                ? options.fromUserTactic
                : state.hasUserImportedTactic,
            unifiedReport,
            selectedSlotIndex: 0,
            playerModalOpen: false,
          };
        });
        if (computedReport) {
          syncDependentStoresFromReport(computedReport);
        }
      },

      syncClubData: ({ players, staff, preferModeB }) => {
        let computedReport: UnifiedReport | null = null;
        set((state) => {
          const nextPlayers =
            players !== undefined ? players.map((p) => ({ ...p })) : state.clubPlayers;
          const nextStaff =
            staff !== undefined ? staff.map((s) => ({ ...s })) : state.clubStaff;

          if (nextPlayers.length < 11 && !state.hasExplicitTactic && !state.unifiedReport) {
            return {
              clubPlayers: nextPlayers,
              clubStaff: nextStaff,
            };
          }

          const useTactic =
            preferModeB || (!state.hasUserImportedTactic && nextPlayers.length >= 11)
              ? null
              : state.tactic;

          const unifiedReport = computeUnifiedSafe({
            tactic: useTactic,
            clubPlayers: nextPlayers,
            clubStaff: nextStaff,
            worldWonderkids: state.worldWonderkids,
            worldStaffPool: state.worldStaffPool,
            patchVersion: state.tactic.patchVersion,
          });
          computedReport = unifiedReport;

          const nextBoardTactic =
            useTactic === null
              ? normalizeLoadedTactic(unifiedReport.tacticAdvice.recommendedTactic)
              : normalizeLoadedTactic(unifiedReport.tacticAdvice.activeTactic);

          return {
            tactic: nextBoardTactic,
            hasExplicitTactic: true,
            hasUserImportedTactic: preferModeB ? false : state.hasUserImportedTactic,
            clubPlayers: nextPlayers,
            clubStaff: nextStaff,
            unifiedReport,
          };
        });
        if (computedReport) {
          syncDependentStoresFromReport(computedReport);
        }
      },

      ingestParsedFmSave: async (parsed, fileName) => {
        set({
          liveFmSave: parsed,
          worldWonderkids: parsed.worldWonderkids,
          worldStaffPool: parsed.worldStaffPool,
          selectedClubUid: null,
        });

        const humanClub =
          parsed.humanClubUid !== null
            ? parsed.clubs.find(
                (c) => c.uid === parsed.humanClubUid && c.playerCount >= 11,
              ) ?? null
            : null;

        if (humanClub) {
          const res = await get().selectClubFromFmSave(humanClub.uid);
          return { selectedClub: res.selectedClub, report: res.report };
        }

        set({
          clubPickerOpen: true,
          fmImportProgress: null,
        });
        void fileName;
        return { selectedClub: null, report: null };
      },

      selectClubFromFmSave: async (clubUid) => {
        const state = get();
        const save = state.liveFmSave;
        if (!save) {
          throw new Error("Belum ada sesi file save .fm yang dimuat.");
        }
        const selectedClub = save.clubs.find((c) => c.uid === clubUid);
        if (!selectedClub) {
          throw new Error(`Klub dengan UID ${clubUid} tidak ditemukan di file save .fm.`);
        }

        const clubPlayers = (save.playersByClub[clubUid] ?? []).map((p) => ({ ...p }));
        const clubStaff = (save.staffByClub[clubUid] ?? []).map((s) => ({ ...s }));
        const keepImportedTactic =
          state.hasUserImportedTactic && clubPlayers.length >= 11 && state.selectedClubUid === null;

        set({
          clubPickerOpen: false,
          fmImportProgress: {
            stage: "Menjalankan Hungarian Solver...",
            pct: 92,
            fileName: save.saveName,
          },
        });

        useSquadStore
          .getState()
          .setSquadFromSave(
            clubPlayers,
            `${selectedClub.name} · ${save.saveName} (${clubPlayers.length} pemain)`,
          );

        try {
          const report = await analyzeUnifiedInWorker({
            tactic: keepImportedTactic
              ? state.tactic
              : clubPlayers.length >= 11
                ? null
                : state.tactic,
            squad: clubPlayers.length >= 11 ? clubPlayers : null,
            clubStaff: clubStaff.length > 0 ? clubStaff : null,
            worldWonderkids: save.worldWonderkids,
            worldStaffPool: save.worldStaffPool,
          });

          const targetTactic = keepImportedTactic
            ? report.tacticAdvice.activeTactic
            : report.tacticAdvice.recommendedTactic;

          const nextBoardTactic = normalizeLoadedTactic({
            ...targetTactic,
            patchVersion: state.tactic.patchVersion,
          });

          set({
            tactic: nextBoardTactic,
            hasExplicitTactic: true,
            hasUserImportedTactic: keepImportedTactic,
            selectedClubUid: clubUid,
            clubPlayers,
            clubStaff,
            unifiedReport: report,
            selectedSlotIndex: 0,
            fmImportProgress: null,
          });

          syncDependentStoresFromReport(report);
          return { selectedClub, report };
        } catch (err) {
          set({ fmImportProgress: null });
          throw err;
        }
      },

      solveBestTacticForCurrentClub: async () => {
        const state = get();
        if (state.clubPlayers.length < 11) return null;
        const report = await analyzeUnifiedInWorker({
          tactic: null,
          squad: state.clubPlayers,
          clubStaff: state.clubStaff.length > 0 ? state.clubStaff : null,
          worldWonderkids:
            state.worldWonderkids.length > 0 ? state.worldWonderkids : null,
          worldStaffPool:
            state.worldStaffPool.length > 0 ? state.worldStaffPool : null,
        });
        const recommendedBoardTactic = normalizeLoadedTactic({
          ...report.tacticAdvice.recommendedTactic,
          patchVersion: state.tactic.patchVersion,
        });
        set({
          tactic: recommendedBoardTactic,
          hasExplicitTactic: true,
          hasUserImportedTactic: false,
          unifiedReport: report,
          selectedSlotIndex: 0,
        });
        syncDependentStoresFromReport(report);
        return report;
      },

      clearFmSaveSession: () => {
        useSquadStore.getState().setSquadFromSave([], "");
        set({
          liveFmSave: null,
          selectedClubUid: null,
          hasUserImportedTactic: false,
          clubPlayers: [],
          clubStaff: [],
          worldWonderkids: [],
          worldStaffPool: [],
          clubPickerOpen: false,
          fmImportProgress: null,
          unifiedReport: null,
        });
      },

      refreshUnifiedReport: () => {
        let computedReport: UnifiedReport | null = null;
        set((state) => {
          computedReport = computeUnifiedSafe({
            tactic: state.tactic,
            clubPlayers: state.clubPlayers,
            clubStaff: state.clubStaff,
            worldWonderkids: state.worldWonderkids,
            worldStaffPool: state.worldStaffPool,
            patchVersion: state.tactic.patchVersion,
          });
          return { unifiedReport: computedReport, unifiedReportMinimized: false };
        });
        if (computedReport) {
          syncDependentStoresFromReport(computedReport);
        }
      },

      dismissUnifiedReport: () => set({ unifiedReport: null }),
      setUnifiedReportMinimized: (unifiedReportMinimized) =>
        set({ unifiedReportMinimized }),
      toggleUnifiedReportMinimized: () =>
        set((state) => ({ unifiedReportMinimized: !state.unifiedReportMinimized })),

      pushTrainingPlanToStore: () => {
        const report = get().unifiedReport;
        if (!report) return false;
        return useTrainingStore.getState().syncFromUnifiedReport(report, true);
      },
    }),
    {
      partialize: (state) => ({ tactic: state.tactic }),
      equality: (pastState, currentState) => pastState.tactic === currentState.tactic,
      limit: 50,
    },
  ),
);
