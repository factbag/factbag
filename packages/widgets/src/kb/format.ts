/**
 * Compact textual rendering of solver structures — goals, atoms, rule bodies,
 * bindings — shared by every kb component.
 */
import { Var } from "@factbag/core/dsl";
import type { Goal, Judgment } from "@factbag/core/query";

import { assertNever } from "../lib/assert-never";

type AtomLike = {
  readonly fields: Readonly<Record<string, unknown>>;
  readonly predicate: { readonly name: string; readonly paramNames: readonly string[] };
};

export function formatGoal(goal: Goal): string {
  switch (goal.kind) {
    case "atom":
      return formatAtom(goal.atom);
    case "not":
      return `not(${formatGoal(goal.goal)})`;
    case "and":
    case "or":
      return `${goal.kind}(${goal.goals.map(formatGoal).join(", ")})`;
    case "exists":
      return `exists(${goal.variables.map((entry) => formatValue(entry)).join(", ")}: ${formatGoal(goal.goal)})`;
    case "add":
    case "count":
    case "div":
    case "eq":
    case "gt":
    case "gte":
    case "let":
    case "lt":
    case "lte":
    case "mul":
    case "neq":
    case "sub":
    case "sum":
      return goal.kind;
    default:
      return assertNever(goal, "Unhandled goal kind");
  }
}

export function formatAtom(atom: AtomLike): string {
  const values = atom.predicate.paramNames.map((name) => formatValue(atom.fields[name]));
  return `${atom.predicate.name}(${values.join(", ")})`;
}

export function formatRule(rule: {
  readonly body: unknown;
  readonly head: { readonly atom: AtomLike };
  readonly kind: "if" | "iff";
}): string {
  return `${formatAtom(rule.head.atom)} ${rule.kind} ${formatBody(rule.body)}`;
}

function formatBody(body: unknown): string {
  if (isAtomLike(body)) {
    return formatAtom(body);
  }
  if (isLiteralLike(body)) {
    return body.sign === "-" ? `not(${formatAtom(body.atom)})` : formatAtom(body.atom);
  }
  if (isFormulaLike(body)) {
    return `${body.kind}(${body.args.map(formatBody).join(", ")})`;
  }
  return formatValue(body);
}

export function formatBindings(bindings: Judgment["bindings"]): string {
  const visible = bindings.filter(([variable]) => !variable.name.startsWith("$"));
  if (visible.length === 0) {
    return "";
  }
  return `, with ${visible
    .map(([variable, value]) => `${variable.name} = ${formatValue(value)}`)
    .join(", ")}`;
}

function formatValue(value: unknown): string {
  if (isVariable(value)) {
    return value.name;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }
  return String(value);
}

function isVariable(value: unknown): value is Var {
  return value instanceof Var;
}

function isAtomLike(value: unknown): value is AtomLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "predicate" in value &&
    "fields" in value &&
    !("sign" in value)
  );
}

function isLiteralLike(
  value: unknown,
): value is { readonly atom: AtomLike; readonly sign: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "sign" in value &&
    "atom" in value &&
    isAtomLike((value as { atom: unknown }).atom)
  );
}

function isFormulaLike(value: unknown): value is {
  readonly args: readonly unknown[];
  readonly kind: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "args" in value &&
    Array.isArray((value as { args: unknown }).args)
  );
}
