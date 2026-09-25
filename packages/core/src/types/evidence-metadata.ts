import type { Annotations } from "./annotations";

/**
 * Provenance metadata attached to accepted evidence literals: `source` names
 * where the fact came from, `citation` quotes or references the supporting
 * material, and `justification` records the asserter's stated reason.
 */
export type EvidenceMetadata = Readonly<{
  /** Name of the system or document the fact came from. */
  source?: string;
  /** Quotation or reference into the supporting material. */
  citation?: string;
  /** The asserter's stated reason for accepting the fact. */
  justification?: string;
  /** Named numeric scores; core stores these without combining or interpreting them. */
  scores?: Readonly<Record<string, number>>;
  /** Application-specific annotations, retained on supporting evidence in judgments. */
  annotations?: Annotations;
}>;
