import { readFileSync } from "node:fs";
import { Corpus } from "@factbag/corpus";
import type { GroundAtom } from "@factbag/core/dsl";
import type { LiteralSign } from "@factbag/core/kb";
import type { DocumentFactory, PredicateDocuments, ScenarioMetadata } from "../types";
import { sharedNeutralDocuments } from "../shared/documents";
import { renderTemplate } from "../templates";
import type { createJ1KB } from "./kb";

export type J1Case =
  | "positive"
  | "negative"
  | "contradictory"
  | "contradictory-document"
  | "neutral";

/** The documents for one case, labeled for the tenure-track target. */
export function createJ1Corpus(
  base: ReturnType<typeof createJ1KB>,
  caseName: J1Case,
): { corpus: Corpus<ScenarioMetadata>; target: GroundAtom } {
  const target = base.predicates.tenureTrack({ person: base.applicant });
  const documents = createJ1Documents(base, target);
  const cases = {
    positive: documents.tenureTrack.assert,
    negative: documents.tenureTrack.deny,
    contradictory: [...documents.tenureTrack.assert, ...documents.tenureTrack.deny],
    "contradictory-document": documents.tenureTrack.contradictory,
    neutral: [],
  };
  const corpus = new Corpus<ScenarioMetadata>();
  corpus.add(
    [...cases[caseName], ...documents.tenureTrack.nearMiss, ...documents.neutral].map(
      (createDocument) => createDocument(),
    ),
  );
  return { corpus, target };
}

function createJ1Documents(
  { applicant, otherApplicant, predicates }: ReturnType<typeof createJ1KB>,
  target: GroundAtom,
): { tenureTrack: Required<PredicateDocuments>; neutral: readonly DocumentFactory[] } {
  const evidence =
    (file: URL, documentId: string, signs: readonly LiteralSign[]): DocumentFactory =>
    () => ({
      documentId,
      text: renderTemplate(file, { applicantName: applicant.name }),
      metadata: {
        kind: "evidence",
        scope: "specific",
        evidence: signs.map((sign) => ({ sign, atom: target })),
        irrelevantTo: [],
      },
    });
  return {
    tenureTrack: {
      predicate: predicates.tenureTrack,
      assert: [
        evidence(
          new URL("../../data/j1/templates/tenure-track-appointment.txt", import.meta.url),
          "j1/document-1",
          ["+"],
        ),
      ],
      deny: [
        evidence(
          new URL("../../data/j1/templates/tenure-track-visiting-appointment.txt", import.meta.url),
          "j1/document-2",
          ["-"],
        ),
      ],
      contradictory: [
        evidence(
          new URL("../../data/j1/templates/tenure-track-conflicting-record.txt", import.meta.url),
          "j1/document-5",
          ["+", "-"],
        ),
      ],
      nearMiss: [
        () => ({
          documentId: "j1/document-4",
          text: renderTemplate(
            new URL("../../data/j1/templates/tenure-track-other-applicant.txt", import.meta.url),
            { otherApplicantName: otherApplicant.name },
          ),
          metadata: { kind: "near-miss", scope: "specific", evidence: [], irrelevantTo: [target] },
        }),
      ],
    },
    neutral: [
      () => ({
        documentId: "j1/document-3",
        text: readFileSync(
          new URL("../../data/j1/lab-inventory-notice.txt", import.meta.url),
          "utf8",
        ),
        metadata: { kind: "neutral", scope: "specific", evidence: [], irrelevantTo: [target] },
      }),
      ...sharedNeutralDocuments([target]),
    ],
  };
}
