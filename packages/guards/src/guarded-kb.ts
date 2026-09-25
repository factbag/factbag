import type { Atom, GroundAtom, PredicateDeclaration, PredicateSchema } from "@factbag/core/dsl";
import type {
  EvidenceMetadata,
  KnowledgeBase,
  NegativeLiteral,
  PositiveLiteral,
} from "@factbag/core/kb";
import { query, queryAll } from "@factbag/core/query";
import type { QueryAllJudgment, QueryJudgment } from "@factbag/core/query";
import type { AllowedPermission, Operation, PermissionFilter } from "./types";

type Rule = Readonly<{
  effect: "permit" | "block";
  operations: readonly Operation[];
  /** `"*"` matches every predicate, including ones the KB references later. */
  predicates: readonly PredicateDeclaration[] | "*";
}>;

const operations: readonly Operation[] = ["assert", "deny", "query"];

/**
 * A permission-enforcing view over one KB. Permission edits return new views;
 * permitted writes change the shared underlying KB.
 * Nothing is permitted by default, and blocks override permits regardless of order.
 * `"*"` matches every operation or predicate and is evaluated when permissions are read.
 */
export class GuardedKB {
  #rules: readonly Rule[] = [];

  constructor(
    /** The underlying, unrestricted KB shared by this view and its branches. */
    readonly kb: KnowledgeBase,
  ) {}

  /** Return a new view permitting every operation for every predicate; shorthand for `permit("*", "*")`. */
  permit(operation: "*"): GuardedKB;
  /** Return a new view permitting the operations for every predicate, including ones the KB references later. */
  permit(operation: Operation | "*", predicates: "*"): GuardedKB;
  /** Return a new view additionally permitting these predicates for the operations. */
  permit(operation: Operation | "*", ...predicates: readonly PredicateDeclaration[]): GuardedKB;
  permit(
    operation: Operation | "*",
    ...predicates: readonly PredicateDeclaration[] | readonly ["*"]
  ): GuardedKB {
    return this.withRule("permit", operation, predicates);
  }

  /** Return a new view blocking every operation for every predicate; shorthand for `block("*", "*")`. */
  block(operation: "*"): GuardedKB;
  /** Return a new view blocking the operations for every predicate, including ones the KB references later. */
  block(operation: Operation | "*", predicates: "*"): GuardedKB;
  /** Return a new view blocking these predicates, including any later permits. */
  block(operation: Operation | "*", ...predicates: readonly PredicateDeclaration[]): GuardedKB;
  block(
    operation: Operation | "*",
    ...predicates: readonly PredicateDeclaration[] | readonly ["*"]
  ): GuardedKB {
    return this.withRule("block", operation, predicates);
  }

  /**
   * Return a view with the same permissions over a fork of the underlying KB.
   * Later writes to either KB do not affect the other; wildcards resolve against each KB separately.
   */
  fork(): GuardedKB {
    const next = new GuardedKB(this.kb.fork());
    next.#rules = this.#rules;
    return next;
  }

  /** Assert evidence after checking permission; throws before writing when forbidden. */
  asserts<Schema extends PredicateSchema>(
    atom: Atom<Schema>,
    metadata?: EvidenceMetadata,
  ): PositiveLiteral<Schema> {
    this.requirePermission("assert", atom.predicate);
    return this.kb.asserts(atom, metadata);
  }

  /** Deny a fact after checking permission; throws before writing when forbidden. */
  denies<Schema extends PredicateSchema>(
    atom: Atom<Schema>,
    metadata?: EvidenceMetadata,
  ): NegativeLiteral<Schema> {
    this.requirePermission("deny", atom.predicate);
    return this.kb.denies(atom, metadata);
  }

  /**
   * Query a permitted ground atom. Permission applies to the requested predicate;
   * evaluation uses the full KB, including supporting predicates and their proofs.
   */
  query<Schema extends PredicateSchema>(atom: GroundAtom<Schema>): QueryJudgment<Schema> {
    this.requirePermission("query", atom.predicate);
    return query(this.kb, atom);
  }

  /** Query all matches for a permitted predicate using the full KB. */
  queryAll<Schema extends PredicateSchema>(pattern: Atom<Schema>): QueryAllJudgment<Schema> {
    this.requirePermission("query", pattern.predicate);
    return queryAll(this.kb, pattern);
  }

  /** Return all effective grants, in first-permitted order. */
  resolve(): readonly AllowedPermission[];
  /** Return effective grants for one operation. */
  resolve(operation: Operation): readonly AllowedPermission[];
  /** Return effective grants for any of these predicates, including query grants. */
  resolve(
    predicate: PredicateDeclaration,
    ...predicates: readonly PredicateDeclaration[]
  ): readonly AllowedPermission[];
  /** Filter effective grants without changing their order or bypassing blocks. */
  resolve(filter: PermissionFilter): readonly AllowedPermission[];
  resolve(
    selection?: Operation | PredicateDeclaration | PermissionFilter,
    ...predicates: readonly PredicateDeclaration[]
  ): readonly AllowedPermission[] {
    let filter: PermissionFilter = {};
    if (typeof selection === "string") {
      filter = { operations: [selection] };
    } else if (selection !== undefined) {
      filter = "name" in selection ? { predicates: [selection, ...predicates] } : selection;
    }

    const known = this.#rules.some((rule) => rule.predicates === "*") ? this.kb.predicates() : [];
    const subjectsOf = (rule: Rule): readonly PredicateDeclaration[] =>
      rule.predicates === "*" ? known : rule.predicates;

    const seen = new Map<Operation, Set<PredicateDeclaration>>();
    const allowed: AllowedPermission[] = [];
    for (const rule of this.#rules) {
      if (rule.effect !== "permit") {
        continue;
      }
      for (const operation of rule.operations) {
        if (filter.operations && !filter.operations.includes(operation)) {
          continue;
        }
        const subjects = seen.get(operation) ?? new Set<PredicateDeclaration>();
        for (const predicate of subjectsOf(rule)) {
          if (filter.predicates && !filter.predicates.includes(predicate)) {
            continue;
          }
          if (subjects.has(predicate) || this.isBlocked(operation, predicate)) {
            continue;
          }
          subjects.add(predicate);
          allowed.push({ operation, predicate });
        }
        seen.set(operation, subjects);
      }
    }
    return allowed;
  }

  private requirePermission(operation: Operation, predicate: PredicateDeclaration): void {
    const permitted = this.#rules.some(
      (rule) => rule.effect === "permit" && matches(rule, operation, predicate),
    );
    if (!permitted || this.isBlocked(operation, predicate)) {
      throw new Error(
        `Operation "${operation}" is not permitted for predicate "${predicate.name}"`,
      );
    }
  }

  private isBlocked(operation: Operation, predicate: PredicateDeclaration): boolean {
    return this.#rules.some(
      (rule) => rule.effect === "block" && matches(rule, operation, predicate),
    );
  }

  private withRule(
    effect: Rule["effect"],
    operation: Operation | "*",
    predicates: readonly PredicateDeclaration[] | readonly ["*"],
  ): GuardedKB {
    const wildcard = predicates[0] === "*" || (operation === "*" && predicates.length === 0);
    const next = new GuardedKB(this.kb);
    next.#rules = [
      ...this.#rules,
      {
        effect,
        operations: operation === "*" ? operations : [operation],
        predicates: wildcard
          ? "*"
          : predicates.filter((predicate): predicate is PredicateDeclaration => predicate !== "*"),
      },
    ];
    return next;
  }
}

function matches(rule: Rule, operation: Operation, predicate: PredicateDeclaration): boolean {
  return (
    rule.operations.includes(operation) &&
    (rule.predicates === "*" || rule.predicates.includes(predicate))
  );
}

/** Wrap a KB with a guard initially permitting no operations. Does not copy the KB. */
export function guard(kb: KnowledgeBase): GuardedKB {
  return new GuardedKB(kb);
}
