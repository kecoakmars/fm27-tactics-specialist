"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import {
  DEFAULT_PATCH_VERSION,
  getPitchCatalog,
  getTacticalStyles,
  migrateTacticToPatch,
} from "@fm27/fm-data";
import {
  computeEffectivePlayerInstructionBits,
  detectFormation,
  getCandidateRolesForSlot,
  inferDutyForRole,
  resolveTeamInstructionConflicts,
} from "@fm27/fm-engine";
import type {
  DualPhaseTactic,
  Duty,
  SlotAssignment,
} from "@fm27/shared-types";

export type PitchViewMode = "ip" | "oop" | "split";

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

export interface TacticStoreState {
  tactic: DualPhaseTactic;
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
  loadTactic: (tactic: DualPhaseTactic) => void;
}

export const useTacticStore = create<TacticStoreState>()(
  temporal(
    (set, get) => ({
      tactic: buildPresetTactic("Gegenpress", "shape-03-433-4141"),
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
        set((state) => ({
          tactic: migrateTacticToPatch(state.tactic, patchVersion),
        })),

      setMentality: (mentality) =>
        set((state) => ({
          tactic: {
            ...state.tactic,
            mentality: Math.max(1, Math.min(7, mentality)),
          },
        })),

      setTeamInstruction: (group, bit, autoResolve = false) =>
        set((state) => {
          const nextTi = { ...state.tactic.teamInstructions, [group]: bit };
          const catalog = getPitchCatalog(state.tactic.patchVersion);
          return {
            tactic: {
              ...state.tactic,
              teamInstructions: autoResolve
                ? resolveTeamInstructionConflicts(nextTi, catalog)
                : nextTi,
            },
          };
        }),

      resolveAllConflicts: () =>
        set((state) => {
          const catalog = getPitchCatalog(state.tactic.patchVersion);
          return {
            tactic: {
              ...state.tactic,
              teamInstructions: resolveTeamInstructionConflicts(
                state.tactic.teamInstructions,
                catalog,
              ),
            },
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
          // Prevent moving GK out of GK or outfielder into GK
          if ((currentPosId === "GK") !== (targetPositionId === "GK")) return state;

          const phaseNum = phase === "ip" ? 0 : 1;
          const occupyingIdx = tactic.slots.findIndex((s, idx) =>
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
            // Swap positions between the two slots
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

          // Re-validate role eligibility for all 11 slots in that phase (since CB/DM counts may have changed!)
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

          return {
            tactic: {
              ...tactic,
              inFormation,
              outFormation,
              slots: updatedSlots,
            },
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

          return { tactic: { ...tactic, slots: updatedSlots } };
        }),

      setSlotDuty: (slotIndex, duty) =>
        set((state) => ({
          tactic: {
            ...state.tactic,
            slots: state.tactic.slots.map((s, idx) =>
              idx === slotIndex
                ? { ...s, inPossession: { ...s.inPossession, duty } }
                : s,
            ),
          },
        })),

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

      applyPresetStyle: (styleId, shapeId) =>
        set((state) => ({
          tactic: buildPresetTactic(styleId, shapeId, state.tactic.patchVersion),
          selectedSlotIndex: 0,
        })),

      applyDualShape: (shapeId) => {
        const currentStyle = get().tactic.styleId ?? "Balanced";
        set((state) => ({
          tactic: buildPresetTactic(currentStyle, shapeId, state.tactic.patchVersion),
          selectedSlotIndex: 0,
        }));
      },

      assignPlayerToSlot: (slotIndex, playerUid, playerName) =>
        set((state) => ({
          tactic: {
            ...state.tactic,
            slots: state.tactic.slots.map((s, idx) => {
              if (idx === slotIndex) {
                return { ...s, playerUid, playerName };
              }
              // Clear duplicate assignment if this player was already on another slot
              if (playerUid !== undefined && s.playerUid === playerUid) {
                return { ...s, playerUid: undefined, playerName: undefined };
              }
              return s;
            }),
          },
        })),

      loadTactic: (tactic) =>
        set({
          tactic,
          selectedSlotIndex: 0,
        }),
    }),
    {
      // Only record actual `tactic` mutations in Undo/Redo history (ignore hover/modal/view switches!)
      partialize: (state) => ({ tactic: state.tactic }),
      equality: (pastState, currentState) => pastState.tactic === currentState.tactic,
      limit: 50,
    },
  ),
);
