import {
  DualPhaseTacticSchema,
  Fm27JsonV1Schema,
  type DualPhaseTactic,
  type Fm27JsonV1,
} from "@fm27/shared-types";
import { validatePlan } from "./tac-serializer.js";

export function exportFm27Json(tactic: DualPhaseTactic): string {
  const parsedTactic = DualPhaseTacticSchema.parse(tactic);
  validatePlan(parsedTactic);

  const envelope: Fm27JsonV1 = {
    schemaVersion: 1,
    game: "FM27",
    patchVersion: parsedTactic.patchVersion,
    exportedAt: new Date().toISOString(),
    tactic: parsedTactic,
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function parseFm27Json(jsonInput: string | unknown): DualPhaseTactic {
  const raw = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
  const parsed = Fm27JsonV1Schema.parse(raw);
  validatePlan(parsed.tactic);
  return parsed.tactic;
}
