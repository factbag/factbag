import type { PredicateDeclaration } from "@factbag/core/dsl";

/** Guarded knowledge-base operations that can be permitted independently. */
export type Operation = "assert" | "deny" | "query";

/** An effective grant after blocks and duplicates have been removed. */
export type AllowedPermission = Readonly<{
  operation: Operation;
  predicate: PredicateDeclaration;
}>;

/** OR within each dimension, AND between dimensions. Empty arrays match nothing. */
export type PermissionFilter = Readonly<{
  /** Omit to match every operation. */
  operations?: readonly Operation[];
  /** Omit to match every predicate. Predicates are matched by identity. */
  predicates?: readonly PredicateDeclaration[];
}>;
