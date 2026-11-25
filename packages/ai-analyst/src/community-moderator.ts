import {
  PlaystyleTagSchema,
  type DualPhaseTactic,
  type ModerationDecision,
  type PlaystyleTag,
} from "@fm27/shared-types";
import { AI_MODELS, getGenAiClientV1Beta } from "./client.js";

const UNSAFE_TERMS_REGEX =
  /\b(casino|viagra|crypto\s*airdrop|telegram\s*pump|hate\s*speech|malware)\b/i;

function inferLocalPlaystyleTag(tactic?: DualPhaseTactic, text = ""): PlaystyleTag {
  const combined = `${tactic?.styleId ?? ""} ${tactic?.title ?? ""} ${text}`.toLowerCase();
  const ti = tactic?.teamInstructions ?? {};

  if (
    combined.includes("tiki") ||
    combined.includes("possession") ||
    ti.PassingDirectness === 4 ||
    (ti.PassingDirectness === 3 && ti.Patience === 17)
  ) {
    return "possession";
  }
  if (
    combined.includes("gegenpress") ||
    ti.TriggerPress === 65 ||
    (ti.LineOfEngagement === 61 && ti.DefensiveTransition === 70)
  ) {
    return "gegenpress";
  }
  if (
    combined.includes("wing") ||
    ti.AttackingWidth === 50 ||
    ti.AttackingWidth === 51 ||
    ti.SupportingRunsSecondary === 25
  ) {
    return "wing_play";
  }
  if (
    combined.includes("counter") ||
    combined.includes("catenaccio") ||
    combined.includes("bus") ||
    ti.LineOfEngagement === 63 ||
    ti.AttackingTransition === 54
  ) {
    return "counter";
  }
  return "balanced";
}

function deterministicModerationFallback(input: {
  title: string;
  description: string;
  tactic?: DualPhaseTactic;
}): ModerationDecision {
  const fullText = `${input.title}\n${input.description}`;
  const isSafe = !UNSAFE_TERMS_REGEX.test(fullText) && input.title.trim().length >= 3;
  const wordCount = input.description.trim().split(/\s+/).filter(Boolean).length;
  const quality = Math.min(1, Math.max(0.15, wordCount / 80));

  return {
    isSafeContent: isSafe,
    safetyConfidence: isSafe ? 0.92 : 0.96,
    playstyleTag: inferLocalPlaystyleTag(input.tactic, fullText),
    guideQualityScore: Math.round(quality * 100) / 100,
  };
}

/**
 * Evaluates community gallery submissions in 1 parallel zero-output-token call
 * via `@google/genai` Decisions API (`v1beta`, `models/gemini-decision-1`).
 */
export async function moderateCommunitySubmission(input: {
  title: string;
  description: string;
  tactic?: DualPhaseTactic;
}): Promise<ModerationDecision> {
  const aiBeta = getGenAiClientV1Beta();
  if (!aiBeta) {
    return deterministicModerationFallback(input);
  }

  const sharedInput = [
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    input.tactic
      ? `Formations: IP ${input.tactic.inFormation} -> OOP ${input.tactic.outFormation} | Mentality ${input.tactic.mentality} | TI ${JSON.stringify(input.tactic.teamInstructions)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await aiBeta.decisions.create({
      model: AI_MODELS.COMMUNITY_DECISION,
      input: sharedInput,
      questions: {
        is_safe_content: {
          type: "noul",
          instructions:
            "Return true if this Football Manager community submission is genuine, safe tactical/training content free of spam, phishing, hate speech, or adult material.",
        },
        playstyle_tag: {
          type: "choice",
          instructions:
            "Classify the primary tactical playstyle of this Football Manager submission.",
          criteria: {
            gegenpress: "Aggressive high press, counter-pressing, high defensive line",
            possession: "Short passing, ball retention, patient build-up through thirds",
            counter: "Compact mid/low block absorbing pressure and attacking space quickly",
            wing_play: "Wide progression, overlaps, and frequent crosses into the box",
            balanced: "Balanced mixed structure adaptable across phases",
          },
        },
        guide_quality: {
          type: "score",
          instructions:
            "Score how informative and complete the tactical guide description is for other Football Manager players.",
          criteria: [
            "Minimal or one-line description with no tactical explanation",
            "Basic summary naming formation or mentality without role details",
            "Clear explanation covering key roles, instructions, or squad requirements",
            "Comprehensive tactical guide explaining IP/OOP transitions, key roles, and match adjustments",
          ],
        },
      },
    });

    const safetyAns = response.answers?.is_safe_content;
    const tagAns = response.answers?.playstyle_tag;
    const scoreAns = response.answers?.guide_quality;

    const isSafeContent =
      safetyAns && "noul" in safetyAns ? safetyAns.noul >= 0.5 : true;
    const safetyConfidence =
      safetyAns && "confidence" in safetyAns ? safetyAns.confidence : 0.85;

    const rawTag = tagAns && "choice" in tagAns ? tagAns.choice : "balanced";
    const parsedTag = PlaystyleTagSchema.safeParse(rawTag);
    const playstyleTag: PlaystyleTag = parsedTag.success
      ? parsedTag.data
      : inferLocalPlaystyleTag(input.tactic, sharedInput);

    const guideQualityScore =
      scoreAns && "score" in scoreAns
        ? Math.min(1, Math.max(0, Math.round((scoreAns.score / 3) * 100) / 100))
        : 0.5;

    return {
      isSafeContent,
      safetyConfidence: Math.round(safetyConfidence * 100) / 100,
      playstyleTag,
      guideQualityScore,
    };
  } catch {
    return deterministicModerationFallback(input);
  }
}
