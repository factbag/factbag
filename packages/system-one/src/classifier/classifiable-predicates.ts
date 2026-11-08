import type { PredicateDeclaration, Scalar, Entity } from "factbag/dsl";
import type { KnowledgeBase, GuardedKB } from "factbag/kb";
import { UnsupportedPredicateError } from "factbag/exceptions";
import type { Action, ClassifiablePredicate } from "./types";

/**
 * Establish which facts the classifier may ask about and which evidence it may write.
 * For each predicate with assert or deny permission, validate its finite field domains
 * and capture the allowed values and the permitted actions.
 * Query-only predicates are excluded.
 *
 * Called once when constructing a run, so unsupported predicates fail before reading
 * the corpus or calling Jev. Each field starts with the values known before any passage
 * is read: open-ended fields, and entity fields with no registered entities, start empty.
 * Candidate combinations are built later, after filtering.
 */
export function classifiablePredicates(access: GuardedKB): readonly ClassifiablePredicate[] {
  const actions = new Map<PredicateDeclaration, Set<Action>>();
  for (const { operation, predicate } of access.resolve()) {
    if (operation !== "query") {
      actions.set(predicate, (actions.get(predicate) ?? new Set<Action>()).add(operation));
    }
  }
  return [...actions].map(([predicate, permitted]) => {
    if (predicate.metadata === undefined || predicate.metadata.description.trim().length === 0) {
      throw new UnsupportedPredicateError(
        `Cannot classify predicate "${predicate.name}": metadata needs a description`,
        predicate,
      );
    }
    if (Object.keys(predicate.params).length !== predicate.paramNames.length) {
      throw new UnsupportedPredicateError(`Invalid schema for ${predicate.name}`, predicate);
    }
    return {
      declaration: predicate,
      actions: permitted,
      roles: Object.fromEntries(
        predicate.paramNames.map((name) => [name, fieldValues({ predicate, name, kb: access.kb })]),
      ),
    };
  });
}

/** Validate a field's type and collect the values known before reading any passage. */
function fieldValues({
  predicate,
  name,
  kb,
}: {
  predicate: PredicateDeclaration;
  name: string;
  kb: KnowledgeBase;
}): readonly (Scalar | Entity)[] {
  const type = predicate.params[name];
  if (type === undefined) {
    throw new UnsupportedPredicateError(
      `Invalid schema for ${predicate.name}: field "${name}" has no type`,
      predicate,
      name,
    );
  }
  /** Open-ended fields take values only from passages. */
  if (type === String || type === Number || type === Date) {
    return [];
  }
  if (type === Boolean) {
    return [false, true];
  }
  if (typeof type === "object") {
    // Members share one of the three finite kinds; dates are distinct by instant.
    const kind = type.values[0] instanceof Date ? "date" : typeof type.values[0];
    const keys = type.values.map((value) => (value instanceof Date ? value.getTime() : value));
    if (
      type.values.length === 0 ||
      (kind !== "string" && kind !== "number" && kind !== "date") ||
      type.values.some((value) => (value instanceof Date ? "date" : typeof value) !== kind) ||
      keys.some((key) => typeof key === "number" && Number.isNaN(key)) ||
      new Set(keys).size !== type.values.length
    ) {
      throw new UnsupportedPredicateError(
        `Invalid enum domain for ${predicate.name}.${name}`,
        predicate,
        name,
      );
    }
    return [...type.values];
  }
  return kb.entities.ids(type).map((id) => {
    const entity = kb.entities.get(type, id);
    if (entity === undefined) {
      throw new Error("A registered entity domain was modified");
    }
    return entity;
  });
}
