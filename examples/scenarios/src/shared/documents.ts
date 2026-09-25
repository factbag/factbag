import type { GroundAtom } from "@factbag/core/dsl";
import type { DocumentFactory } from "../types";

/** Shared synthetic background, labeled only for the consuming scenario's targets. */
export function sharedNeutralDocuments(targets: readonly GroundAtom[]): readonly DocumentFactory[] {
  return [
    () => ({
      documentId: "shared/printer-maintenance",
      text: readFileSync(
        new URL("../../data/shared/printer-maintenance.txt", import.meta.url),
        "utf8",
      ),
      metadata: { kind: "neutral", scope: "shared", evidence: [], irrelevantTo: targets },
    }),
  ];
}
import { readFileSync } from "node:fs";
