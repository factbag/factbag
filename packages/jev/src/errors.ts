/**
 * Errors raised by the classifier.
 *
 * @packageDocumentation
 */
import type { PredicateDeclaration } from "@factbag/core/dsl";

/** A predicate cannot be classified over a supported finite domain. Raised during registration. */
export class UnsupportedPredicateError extends Error {
  constructor(
    message: string,
    /** Predicate whose registration failed. */
    readonly predicate: PredicateDeclaration,
    /** Unsupported or invalid field, when the error concerns a specific field. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "UnsupportedPredicateError";
  }
}
