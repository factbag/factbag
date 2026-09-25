import { and, enumeration, or, predicate } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import type { AnyLiteral, EvidenceMetadata } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import type { Judgment } from "@factbag/core/query";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import { classifier } from "../src/classifier";
import { distribution } from "./fixtures";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { mockJev } from "./mock-jev";
import type { Assessment, DemoAnswer, Fixture } from "./fixtures";
import { supportScore } from "./support-score";

type ReviewDecision = Readonly<{
  action: "exclude";
  evidence: AnyLiteral;
  reviewer: string;
  reason: string;
}>;

export type SanctionsDemo = Readonly<{
  corpus: Corpus;
  kb: KnowledgeBase;
  company: string;
  asOf: string;
  ownershipBasisPoints: number;
  structuredEvidence: readonly AnyLiteral[];
  assessments: readonly Assessment[];
  directlyListed: Judgment;
  initial: Judgment;
  disputed: Judgment;
  resolved: Judgment;
  review: ReviewDecision;
  score: number | null;
  strengthened: Judgment;
  strengthenedScore: number | null;
  extractions: number;
}>;

/** Fictional records and entities; models one majority nominee holding, not a complete sanctions regime. */
export async function runSanctionsDemo(
  options: Readonly<{ ownershipBasisPoints?: number }> = {},
): Promise<SanctionsDemo> {
  const ownershipBasisPoints = options.ownershipBasisPoints ?? 6000;
  if (
    !Number.isSafeInteger(ownershipBasisPoints) ||
    ownershipBasisPoints < 0 ||
    ownershipBasisPoints > 10000
  ) {
    throw new Error("ownershipBasisPoints must be an integer between 0 and 10000");
  }
  const corpus = new Corpus();
  let kb = new KnowledgeBase();
  const asOf = "2026-09-01";
  const company = "Harbor Components";
  // IDs in these fixtures are already resolved to the entities being screened.
  const fields = { company: "company-42", nominee: "nominee-12", owner: "owner-7", asOf } as const;
  // Explicit domains for this bounded screening case, not guessed string candidates.
  const arrangementSchema = {
    company: enumeration(fields.company),
    nominee: enumeration(fields.nominee),
    owner: enumeration(fields.owner),
    asOf: enumeration(asOf),
  };
  const subject = { company: fields.company, asOf };
  const listed = predicate("directly_listed", { entity: String, asOf: String });
  const majorityStake = predicate("registered_stake_at_least_fifty_percent", {
    company: String,
    nominee: String,
    asOf: String,
  });
  const heldForOwner = predicate("nominee_holds_for_owner", arrangementSchema, {
    description:
      "The nominee holds its registered stake in the company for the beneficial ownership of the specified owner, under the arrangement being assessed at the screening date.",
    instructions:
      "Require evidence of ownership, not just voting influence, board appointments, business ties, or shared addresses. Do not infer ownership percentages or sanctions-list membership. Whether the arrangement is still in force is assessed separately.",
  });
  const inForce = predicate("nominee_arrangement_in_force", arrangementSchema, {
    description:
      "The nominee arrangement between these parties is in force at the supplied screening date.",
    instructions:
      "A draft, an unsigned proposal, or the existence of an old document alone does not establish that the arrangement is currently in force. Look for an effective arrangement covering the screening date.",
  });
  const ownedByBlockedPerson = predicate("majority_owned_by_blocked_person", {
    company: String,
    asOf: String,
  });
  const blocked = predicate("blocked_under_demo_policy", { company: String, asOf: String });
  kb.rule(ownedByBlockedPerson(subject)).iff(
    and(
      listed({ entity: fields.owner, asOf }),
      majorityStake({ company: fields.company, nominee: fields.nominee, asOf }),
      heldForOwner(fields),
      inForce(fields),
    ),
  );
  kb.rule(blocked(subject)).iff(
    or(listed({ entity: fields.company, asOf }), ownedByBlockedPerson(subject)),
  );

  // Structured snapshots are imported by code. No model is asked to read these.
  const listSnapshot = {
    snapshotId: "fictional-blocking-list-2026-09-01",
    asOf,
    blockedEntityIds: [fields.owner],
  };
  const ownershipRecord = {
    recordId: "register-row-42",
    asOf,
    company: fields.company,
    holder: fields.nominee,
    basisPoints: ownershipBasisPoints,
  };
  const listDocument = corpus.add({
    documentId: listSnapshot.snapshotId,
    text: JSON.stringify(listSnapshot, null, 2),
    metadata: { kind: "structured" },
  });
  const ownershipDocument = corpus.add({
    documentId: ownershipRecord.recordId,
    text: JSON.stringify(ownershipRecord, null, 2),
    metadata: { kind: "structured" },
  });
  const listSource = corpus.slice(listDocument, { start: 0, end: listDocument.text.length });
  const ownershipSource = corpus.slice(ownershipDocument, {
    start: 0,
    end: ownershipDocument.text.length,
  });
  const listMetadata: EvidenceMetadata = {
    source: listSource.id,
    // One means "taken as given in this demo", not a model probability or a source-accuracy estimate.
    scores: { support: 1 },
    annotations: {
      ingestion: {
        kind: "structured",
        snapshot: listSnapshot.snapshotId,
        method: "exact-entity-id-lookup",
        asOf,
      },
    },
  };
  const structuredEvidence: AnyLiteral[] = [];
  for (const entity of [fields.company, fields.owner]) {
    const atom = listed({ entity, asOf });
    structuredEvidence.push(
      listSnapshot.blockedEntityIds.some((id) => id === entity)
        ? kb.asserts(atom, listMetadata)
        : kb.denies(atom, listMetadata),
    );
  }
  const stakeAtom = majorityStake({ company: fields.company, nominee: fields.nominee, asOf });
  const stakeMetadata: EvidenceMetadata = {
    source: ownershipSource.id,
    scores: { support: 1 },
    annotations: {
      ingestion: {
        kind: "structured",
        method: "integer-threshold",
        basisPoints: ownershipRecord.basisPoints,
        thresholdBasisPoints: 5000,
        asOf,
      },
    },
  };
  structuredEvidence.push(
    ownershipRecord.basisPoints >= 5000
      ? kb.asserts(stakeAtom, stakeMetadata)
      : kb.denies(stakeAtom, stakeMetadata),
  );
  const directlyListed = query(kb, listed({ entity: fields.company, asOf }));
  const initial = query(kb, blocked(subject));

  const inputs = [
    {
      documentId: "executed-nominee-deed",
      text: "The executed deed states that Alder Nominees (nominee-12) holds its registered stake in Harbor Components (company-42) for the beneficial ownership of Oriole Holdings (owner-7).",
    },
    {
      documentId: "current-legal-confirmation",
      text: "The legal confirmation states that the nominee arrangement between nominee-12 and owner-7 concerning company-42 remains in force on 2026-09-01.",
    },
    {
      documentId: "superseded-onboarding-memo",
      text: "The earlier onboarding memo states that nominee-12 holds the stake in company-42 for its own account and not for owner-7.",
    },
    {
      documentId: "board-announcement",
      text: "Oriole Holdings (owner-7) has appointed two directors to the board of Harbor Components (company-42).",
    },
  ];
  corpus.add(inputs);
  const documentary = corpus.filter((document) => document.metadata["kind"] !== "structured");
  const irrelevant = distribution(0.01, 0.01, 0.98);
  const inForceAnswer = (documentId: string): DemoAnswer =>
    documentId === "current-legal-confirmation"
      ? distribution(0.87, 0.03, 0.1)
      : documentId === "supplemental-legal-confirmation"
        ? distribution(0.92, 0.02, 0.06)
        : irrelevant;
  const fixtures: Fixture[] = documentary.documents().flatMap((document) => [
    {
      text: document.text,
      predicate: heldForOwner.name,
      answers: {
        candidate_0: {
          fields,
          answer:
            document.documentId === "executed-nominee-deed"
              ? distribution(0.96, 0.02, 0.02)
              : document.documentId === "superseded-onboarding-memo"
                ? distribution(0.01, 0.98, 0.01)
                : irrelevant,
        },
      },
    },
    {
      text: document.text,
      predicate: inForce.name,
      answers: { candidate_0: { fields, answer: inForceAnswer(document.documentId) } },
    },
  ]);
  using mock = mockJev(fixtures);
  const client = new TypeSafeClient(mock.clientOptions);
  const assessments: Assessment[] = [];
  const run = classifier(
    documentary,
    guard(kb).permit("assert", heldForOwner, inForce).permit("deny", heldForOwner, inForce),
    {
      client,
      admission: { minimumProbability: 0.3, ambiguityMargin: 0.05 },
    },
  );
  for (const job of run) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- This demo intentionally consumes one remote job at a time.
    assessments.push(await job.execute());
  }
  kb = run.kb;
  const disputed = query(kb, blocked(subject));
  const denial = kb.literals().find((literal) => {
    const source = literal.metadata?.source;
    return (
      literal.sign === "-" &&
      literal.atom.predicate === heldForOwner &&
      source !== undefined &&
      corpus.resolve(source).document.documentId === "superseded-onboarding-memo"
    );
  });
  if (denial === undefined) {
    throw new Error("The scripted scenario must contain the onboarding memo's denial");
  }
  const review: ReviewDecision = {
    action: "exclude",
    evidence: denial,
    reviewer: "Morgan, sanctions analyst",
    reason:
      "The analyst checked that the executed deed supersedes the onboarding memo for this same stake; the legal confirmation establishes that the arrangement covers the screening date.",
  };
  kb.retract(denial);
  const resolved = query(kb, blocked(subject));

  // Another source for the same unresolved reading, not a new legal rule or another ownership stake.
  const laterText =
    "A signed supplemental legal confirmation states that the nominee-12 arrangement for owner-7's interest in company-42 was in force on 2026-09-01.";
  const later = corpus.add({ documentId: "supplemental-legal-confirmation", text: laterText });
  fixtures.push({
    text: laterText,
    predicate: inForce.name,
    answers: { candidate_0: { fields, answer: inForceAnswer(later.documentId) } },
  });
  // Only the new document is read; its chunks still register in the shared corpus.
  const supplement = classifier(
    corpus.filter((document) => document.documentId === later.documentId),
    guard(kb).permit("assert", inForce).permit("deny", inForce),
    {
      client,
      admission: { minimumProbability: 0.3, ambiguityMargin: 0.05 },
    },
  );
  for (const job of supplement) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Consumer-controlled sequential execution.
    await job.execute();
  }
  kb = supplement.kb;
  const strengthened = query(kb, blocked(subject));
  return {
    corpus,
    kb,
    company,
    asOf,
    ownershipBasisPoints,
    structuredEvidence,
    assessments,
    directlyListed,
    initial,
    disputed,
    resolved,
    review,
    score: supportScore(resolved),
    strengthened,
    strengthenedScore: supportScore(strengthened),
    extractions: assessments.length,
  };
}
