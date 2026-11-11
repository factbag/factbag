/** Shared shape for every compact, LLM-readable explanation node. */
export type ExplanationBase = Readonly<{
  /** The evaluated claim and its value, e.g. `eligible(alice) = true`. */
  claim: string;
  /**
   * Claims this one also rests on that a budget left unexplained, each with its value,
   * e.g. `resident(alice) = true`. What decided a claim is explained before what did
   * not, so these are most often claims that were evaluated and changed nothing.
   */
  notShown?: readonly string[];
}>;

/**
 * A compact, LLM-readable explanation node.
 *
 * Example intended contents for a derived claim:
 *
 * ```json
 * {
 *   "claim": "eligible(alice) = true",
 *   "because": "eligible(P) iff not(active_sanction(P))",
 *   "given": [
 *     {
 *       "claim": "not(active_sanction(alice)) = true",
 *       "because": "active_sanction(alice) is closed-world, and no evidence is known"
 *     }
 *   ]
 * }
 * ```
 */
export type Explanation =
  | EvidenceExplanation
  | DerivedExplanation
  | CompoundExplanation
  | TerminalExplanation;

/**
 * A claim explained directly by accepted evidence.
 *
 * Example intended contents for one supporting source:
 *
 * ```json
 * {
 *   "claim": "active_sanction(bob) = true",
 *   "because": {
 *     "source": "sanctions_registry",
 *     "citation": "Bob appears on the active sanctions list."
 *   }
 * }
 * ```
 *
 * Example intended contents for conflicting evidence:
 *
 * ```json
 * {
 *   "claim": "active_sanction(drew) = conflicted",
 *   "because": [
 *     {
 *       "claim": "active_sanction(drew) = true",
 *       "source": "sanctions_registry",
 *       "citation": "Drew appears on the active sanctions list."
 *     },
 *     {
 *       "claim": "active_sanction(drew) = false",
 *       "source": "appeals_board",
 *       "citation": "Drew's sanction was overturned on appeal."
 *     }
 *   ]
 * }
 * ```
 */
export type EvidenceExplanation = ExplanationBase &
  Readonly<{
    because: EvidenceReason | readonly EvidenceReason[];
  }>;

/**
 * A claim explained by applying a rule to subclaims.
 *
 * Example intended contents:
 *
 * ```json
 * {
 *   "claim": "eligible(bob) = false",
 *   "because": "eligible(P) iff not(active_sanction(P))",
 *   "given": [
 *     {
 *       "claim": "not(active_sanction(bob)) = false",
 *       "given": [
 *         {
 *           "claim": "active_sanction(bob) = true",
 *           "because": {
 *             "source": "sanctions_registry",
 *             "citation": "Bob appears on the active sanctions list."
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export type DerivedExplanation = ExplanationBase &
  Readonly<{
    because: string;
    given: readonly Explanation[];
  }>;

/**
 * A claim explained by combining subclaims, such as an `and`, `or`, or `not` goal.
 *
 * Example intended contents:
 *
 * ```json
 * {
 *   "claim": "not(active_sanction(drew)) = conflicted",
 *   "given": [
 *     {
 *       "claim": "active_sanction(drew) = conflicted",
 *       "because": [
 *         {
 *           "claim": "active_sanction(drew) = true",
 *           "source": "sanctions_registry",
 *           "citation": "Drew appears on the active sanctions list."
 *         },
 *         {
 *           "claim": "active_sanction(drew) = false",
 *           "source": "appeals_board",
 *           "citation": "Drew's sanction was overturned on appeal."
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export type CompoundExplanation = ExplanationBase &
  Readonly<{
    because?: string;
    given: readonly Explanation[];
  }>;

/**
 * A terminal non-evidence explanation, such as closed-world absence or an unknown.
 *
 * Example intended contents:
 *
 * ```json
 * {
 *   "claim": "not(active_sanction(alice)) = true",
 *   "because": "active_sanction(alice) is closed-world, and no evidence is known"
 * }
 * ```
 */
export type TerminalExplanation = ExplanationBase &
  Readonly<{
    because: string;
  }>;

/**
 * Evidence metadata embedded directly under `because`.
 *
 * Example intended contents for a single source:
 *
 * ```json
 * {
 *   "source": "sanctions_registry",
 *   "citation": "Bob appears on the active sanctions list."
 * }
 * ```
 *
 * Example intended contents when the evidence reason names its side explicitly:
 *
 * ```json
 * {
 *   "claim": "active_sanction(drew) = false",
 *   "source": "appeals_board",
 *   "citation": "Drew's sanction was overturned on appeal.",
 *   "metadata": { "reviewed_by": "appeals_panel" }
 * }
 * ```
 */
export type EvidenceReason = Readonly<{
  /**
   * What this evidence says, e.g. `active_sanction(drew) = false`. Left out when it only
   * repeats the claim of the explanation it sits under and the evidence has provenance.
   */
  claim?: string;

  /** Where the evidence came from, e.g. `sanctions_registry`. */
  source?: string;

  /** The words of the source that support the claim, as recorded with the evidence. */
  citation?: string;

  /** Why the citation supports the claim, as stated by whoever recorded the evidence. */
  justification?: string;

  /** Raw source-specific details that should not be flattened into prose. */
  metadata?: Readonly<Record<string, unknown>>;
}>;
