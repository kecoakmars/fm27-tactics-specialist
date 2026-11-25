import { getCoachingKnowledge, getPitchCatalog } from "@fm27/fm-data";
import { computeTacticalBalance } from "@fm27/fm-engine";
import type { DualPhaseTactic, Player } from "@fm27/shared-types";
import {
  getGenAiClientV1,
  resolveAdvisorModel,
  type TacticalAdvisorModelTier,
} from "./client.js";

export interface TacticalStreamChunk {
  type: "delta" | "completed";
  text?: string;
  interactionId?: string;
  modelUsed: string;
  fallback: boolean;
}

export interface TacticalReviewRequest {
  prompt: string;
  tactic: DualPhaseTactic;
  squad?: Player[];
  previousInteractionId?: string;
  tier?: TacticalAdvisorModelTier;
}

const SYSTEM_INSTRUCTION = [
  "You are an elite Football Manager 27 tactical analyst grounded strictly in the provided deterministic engine JSON.",
  "Never invent player names, role names, or instruction bits outside the supplied FM27 context.",
  "Structure advice concisely with: (1) Structural Diagnosis across IP/OOP & Zone 14/Half-Spaces, (2) Concrete Role/Duty or Team Instruction adjustments, and (3) Transition Risk notes.",
  "Reply in the same language used by the user prompt.",
].join(" ");

export function buildStructuredTacticalContext(
  tactic: DualPhaseTactic,
  squad?: Player[],
): Record<string, unknown> {
  const catalog = getPitchCatalog(tactic.patchVersion);
  const balance = computeTacticalBalance(tactic, squad);

  const activeInstructions: string[] = [];
  for (const [grp, bit] of Object.entries(tactic.teamInstructions)) {
    if (bit <= 0) continue;
    const g = catalog.Instructions.find((i) => i.Group === grp);
    const opt = g?.Options.find((o) => o.Bit === bit);
    if (g && opt) activeInstructions.push(`${g.Label}: ${opt.Label} (bit ${bit})`);
  }

  return {
    title: tactic.title,
    patchVersion: tactic.patchVersion,
    mentality: tactic.mentality,
    formations: {
      inPossession: tactic.inFormation,
      outOfPossession: tactic.outFormation,
    },
    activeTeamInstructions: activeInstructions,
    slots: tactic.slots.map((s) => ({
      slot: s.slotIndex + 1,
      player: s.playerName ?? null,
      ip: `${s.inPossession.positionId} (${s.inPossession.roleId} - ${s.inPossession.duty})`,
      oop: `${s.outOfPossession.positionId} (${s.outOfPossession.roleId})`,
    })),
    spatialMetrics: {
      overallBalanceScore: balance.overallScore,
      pillars: balance.pillars,
      zone14IntensityIp: balance.heatmap.zone14IntensityIp,
      leftHalfSpaceIp: balance.heatmap.leftHalfSpaceIntensityIp,
      rightHalfSpaceIp: balance.heatmap.rightHalfSpaceIntensityIp,
      avgTransitionDistance: balance.heatmap.averageTransitionDistance,
    },
    structuralAlerts: balance.alerts,
  };
}

function buildDeterministicFallbackAdvisory(
  req: TacticalReviewRequest,
): string {
  const balance = computeTacticalBalance(req.tactic, req.squad);
  const ck = getCoachingKnowledge(req.tactic.patchVersion);
  const sourceTitleById = new Map(ck.Sources.map((s) => [s.Id, `${s.Publisher}: ${s.Title}`]));

  const lines: string[] = [
    `### Audit Deterministik FM27 (${req.tactic.inFormation} IP → ${req.tactic.outFormation} OOP)`,
    `- **Skor Keseimbangan:** \`${balance.overallScore}/100\` | **Zone 14 IP:** \`${balance.heatmap.zone14IntensityIp}%\` | **Jarak Transisi Rata-rata:** \`Δ${balance.heatmap.averageTransitionDistance}m\``,
    `- **6 Pilar:** Attacking \`${balance.pillars.attackingThreat}\` · Build-Up \`${balance.pillars.buildUpProgression}\` · Rest-Defense \`${balance.pillars.restDefenseStability}\` · Width/HS \`${balance.pillars.widthAndHalfSpaceCoverage}\` · Pressing \`${balance.pillars.pressingCohesion}\` · Transition \`${balance.pillars.transitionResilience}\``,
    "",
  ];

  if (balance.alerts.length === 0) {
    lines.push(
      "**Diagnosis Struktural:** Distribusi spasial 18-zona dan rest-defense sudah seimbang tanpa celah kritis.",
    );
  } else {
    lines.push("**Temuan & Rekomendasi Koreksi:**");
    for (const alert of balance.alerts.slice(0, 4)) {
      const refs = alert.citations
        .map((id) => sourceTitleById.get(id) ?? id)
        .slice(0, 2)
        .join("; ");
      lines.push(
        `- **[${alert.severity.toUpperCase()}] ${alert.title}:** ${alert.detail}${
          alert.autoFix ? ` → *Auto-Fix:* \`${alert.autoFix.text}\`` : ""
        }${refs ? ` *(Ref: ${refs})*` : ""}`,
      );
    }
  }

  const lowerPrompt = req.prompt.toLowerCase();
  if (lowerPrompt.includes("underdog") || lowerPrompt.includes("bertahan")) {
    lines.push(
      "",
      "**Adaptasi Underdog:** Turunkan Mentality ke `Cautious (3)`, set `Line of Engagement = Mid Block (bit 62)`, aktifkan `Counter-Attack (bit 54)` & `Regroup (bit 71)`, serta pastikan minimal 1 `OPScreeningDefensiveMidfielder` menutup Zone 14.",
    );
  } else if (lowerPrompt.includes("4-3-3") || lowerPrompt.includes("counter")) {
    lines.push(
      "",
      "**Counter 4-3-3 Gegenpress:** Gunakan progresi lewat half-space atau `Bypass the Press (bit 8)` bila atribut `build` bek/pivot < 12.5, dan kunci bek sayap menjadi `InsideFullBack` / `OPHoldingFullBack` untuk meredam *Inside Forward* lawan.",
    );
  }

  lines.push(
    "",
    "*(Mode Offline/Lokal aktif karena `GEMINI_API_KEY` belum dikonfigurasi — seluruh metrik dihitung langsung oleh `@fm27/fm-engine`.)*",
  );

  return lines.join("\n");
}

/**
 * Streams tactical analysis via `@google/genai` Interactions API v1 (`client.interactions.create`),
 * preserving `previous_interaction_id` for multi-turn Q&A and degrading gracefully when offline.
 */
export async function* streamTacticalReview(
  req: TacticalReviewRequest,
): AsyncGenerator<TacticalStreamChunk, void, unknown> {
  const model = resolveAdvisorModel(req.tier ?? "standard");
  const client = getGenAiClientV1();

  if (!client) {
    const fallbackText = buildDeterministicFallbackAdvisory(req);
    const paragraphs = fallbackText.split("\n");
    for (const line of paragraphs) {
      yield {
        type: "delta",
        text: `${line}\n`,
        modelUsed: "fm-engine-local",
        fallback: true,
      };
    }
    yield {
      type: "completed",
      interactionId: `local-${Date.now()}`,
      modelUsed: "fm-engine-local",
      fallback: true,
    };
    return;
  }

  // Inject structured fm-engine context on turn 1 so the model never hallucinates FM27 roles/metrics
  const inputPayload = req.previousInteractionId
    ? req.prompt
    : [
        "=== FM27 ENGINE STRUCTURED TACTICAL SNAPSHOT ===",
        JSON.stringify(buildStructuredTacticalContext(req.tactic, req.squad)),
        "=== USER QUESTION ===",
        req.prompt,
      ].join("\n");

  try {
    const stream = await client.interactions.create({
      model,
      system_instruction: SYSTEM_INSTRUCTION,
      input: inputPayload,
      ...(req.previousInteractionId
        ? { previous_interaction_id: req.previousInteractionId }
        : {}),
      stream: true,
    });

    let completedId = req.previousInteractionId ?? "";

    for await (const event of stream) {
      if (event.event_type === "step.delta" && event.delta.type === "text") {
        yield {
          type: "delta",
          text: event.delta.text,
          modelUsed: model,
          fallback: false,
        };
      } else if (event.event_type === "interaction.completed") {
        completedId = event.interaction.id;
      }
    }

    yield {
      type: "completed",
      interactionId: completedId,
      modelUsed: model,
      fallback: false,
    };
  } catch {
    // Graceful degradation if network/quota fails mid-request
    const fallbackText = buildDeterministicFallbackAdvisory(req);
    yield {
      type: "delta",
      text: fallbackText,
      modelUsed: "fm-engine-local",
      fallback: true,
    };
    yield {
      type: "completed",
      interactionId: `local-${Date.now()}`,
      modelUsed: "fm-engine-local",
      fallback: true,
    };
  }
}
