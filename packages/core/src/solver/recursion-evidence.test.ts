import { describe, expect, it } from "vitest";
import { and, closedPredicate, or, predicate, variable } from "../dsl";
import type { Atom, ClosedWorldPredicate, OpenWorldPredicate } from "../dsl";
import { KnowledgeBase } from "../knowledge-base";
import { query } from "../query";
import type { GoalValue } from "../types/common";

type World = "closed" | "open";
type Evidence = "none" | "asserted" | "denied" | "both";
type Kind = "iff" | "if";
type Body = string | { and: Body[] } | { or: Body[] };
type Program = Readonly<{
  worlds: Readonly<Record<string, World>>;
  evidence: Readonly<Record<string, Evidence>>;
  rules: readonly Readonly<{ head: string; kind: Kind; body: Body }>[];
}>;

// Independent truth tables, not the solver's goal-value helpers.
const ORDER = ["false", "unknown", "conflicted", "true"] as const;
function maximum(values: readonly GoalValue[]): GoalValue {
  return ORDER.reduce<GoalValue>((best, value) => (values.includes(value) ? value : best), "false");
}
function bodyValue(body: Body, values: Readonly<Record<string, GoalValue>>): GoalValue {
  if (typeof body === "string") {
    const value = values[body];
    if (value === undefined) {
      throw new Error(`No value for ${body}`);
    }
    return value;
  }
  if ("or" in body) {
    return maximum(body.or.map((part) => bodyValue(part, values)));
  }
  const conjuncts = body.and.map((part) => bodyValue(part, values));
  return ORDER.find((value) => conjuncts.includes(value)) ?? "true";
}

function combine(world: World, evidence: Evidence, contributions: readonly GoalValue[]): GoalValue {
  const definite = contributions.filter((value) => value !== "unknown");
  const positiveEvidence = evidence === "asserted" || evidence === "both";
  const negativeEvidence = evidence === "denied" || evidence === "both";
  if (
    (positiveEvidence && definite.some((value) => value === "false" || value === "conflicted")) ||
    (negativeEvidence && definite.some((value) => value === "true" || value === "conflicted"))
  ) {
    return "conflicted";
  }
  const values = [...definite];
  if (evidence !== "none") {
    values.push(evidence === "both" ? "conflicted" : evidence === "asserted" ? "true" : "false");
  }
  if (values.length > 0) {
    return maximum(values);
  }
  return contributions.length > 0 || world === "open" ? "unknown" : "false";
}

/** Synchronous rounds from bottom, independent of the solver's demand-driven worklist. */
function reference(program: Program): Readonly<Record<string, GoalValue>> {
  const atoms = Object.keys(program.worlds);
  let values: Record<string, GoalValue> = Object.fromEntries(atoms.map((atom) => [atom, "false"]));
  for (let round = 0; round <= 3 * atoms.length + 1; round += 1) {
    const current = values;
    const next: Record<string, GoalValue> = {};
    for (const atom of atoms) {
      const contributions = program.rules
        .filter((rule) => rule.head === atom)
        .map((rule) => {
          const value = bodyValue(rule.body, current);
          return rule.kind === "if" && value === "false" ? "unknown" : value;
        });
      next[atom] = combine(
        program.worlds[atom] ?? "closed",
        program.evidence[atom] ?? "none",
        contributions,
      );
    }
    if (atoms.every((atom) => next[atom] === current[atom])) {
      return next;
    }
    values = next;
  }
  throw new Error("Reference did not converge");
}

class Person {
  constructor(readonly id: string) {}
}
const x = new Person("x");
const P = variable("P");
type Declared =
  | ClosedWorldPredicate<{ p: typeof Person }>
  | OpenWorldPredicate<{ p: typeof Person }>;

function build(
  program: Program,
  ruleOrder: readonly number[],
  evidenceOrder: "assert-first" | "deny-first",
) {
  const kb = new KnowledgeBase();
  kb.entities.add(x);
  const atoms = new Map<string, Declared>();
  for (const [name, world] of Object.entries(program.worlds)) {
    atoms.set(
      name,
      world === "closed" ? closedPredicate(name, { p: Person }) : predicate(name, { p: Person }),
    );
  }
  const declared = (name: string): Declared => {
    const atom = atoms.get(name);
    if (atom === undefined) {
      throw new Error(`Undeclared ${name}`);
    }
    return atom;
  };
  const formula = (body: Body): Atom<{ p: typeof Person }> | ReturnType<typeof and> => {
    if (typeof body === "string") {
      return declared(body)({ p: P });
    }
    return "and" in body ? and(...body.and.map(formula)) : or(...body.or.map(formula));
  };
  for (const [name, evidence] of Object.entries(program.evidence)) {
    const steps = [
      ...(evidence === "asserted" || evidence === "both" ? ["assert"] : []),
      ...(evidence === "denied" || evidence === "both" ? ["deny"] : []),
    ];
    for (const step of evidenceOrder === "assert-first" ? steps : [...steps].reverse()) {
      if (step === "assert") {
        kb.asserts(declared(name)({ p: x }));
      } else {
        kb.denies(declared(name)({ p: x }));
      }
    }
  }
  for (const index of ruleOrder) {
    const rule = program.rules[index];
    if (rule === undefined) {
      throw new Error(`No rule ${String(index)}`);
    }
    const builder = kb.rule(declared(rule.head)({ p: P }));
    if (rule.kind === "iff") {
      builder.iff(formula(rule.body));
    } else {
      builder.if(formula(rule.body));
    }
  }
  return { kb, atoms };
}

function permutations(count: number): readonly (readonly number[])[] {
  if (count <= 1) {
    return [[0]];
  }
  return permutations(count - 1).flatMap((order) =>
    Array.from({ length: order.length + 1 }, (_, at) => [
      ...order.slice(0, at),
      count - 1,
      ...order.slice(at),
    ]),
  );
}

function fragmentPrograms() {
  const programs: { name: string; program: Program }[] = [];
  for (const kindA of ["iff", "if"] as const) {
    for (const kindB of ["iff", "if"] as const) {
      for (const seed of ["none", "asserted", "denied", "both"] as const) {
        for (const gate of ["none", "asserted", "denied", "both"] as const) {
          (["two-cycle", "three-cycle"] as const).forEach((shape) => {
            programs.push({
              name: `${shape}, ${kindA}/${kindB}, seed:${seed}, gate:${gate}`,
              program: {
                worlds: {
                  a: "closed",
                  b: "closed",
                  seed: "closed",
                  gate: "closed",
                  ...(shape === "three-cycle" ? { c: "closed" as const } : {}),
                },
                evidence: { seed, gate },
                rules:
                  shape === "two-cycle"
                    ? [
                        { head: "a", kind: kindA, body: { or: ["b", "seed"] } },
                        { head: "b", kind: kindB, body: { and: ["a", "gate"] } },
                      ]
                    : [
                        { head: "a", kind: kindA, body: "b" },
                        { head: "b", kind: kindB, body: "c" },
                        { head: "c", kind: "iff", body: { or: [{ and: ["a", "gate"] }, "seed"] } },
                      ],
              },
            });
          });
        }
      }
    }
  }
  return programs;
}

/** Generated program families do not fit the declarative example lifecycle. */
describe("query", () => {
  it.each(fragmentPrograms())("finds the least fixed point for $name", ({ program }) => {
    // Arrange
    const expected = reference(program);
    for (const ruleOrder of permutations(program.rules.length)) {
      for (const evidenceOrder of ["assert-first", "deny-first"] as const) {
        const { kb, atoms } = build(program, ruleOrder, evidenceOrder);
        // Act
        const actual = Object.fromEntries(
          [...atoms].map(([name, atom]) => [name, query(kb, atom({ p: x })).value]),
        );
        // Assert
        expect(actual, `${ruleOrder.join(",")}, ${evidenceOrder}`).toEqual(expected);
      }
    }
  });
});

/** Measured on the original solver: keep entry-dependent answers until semantics is decided. */
const PINNED: readonly (readonly [World, Evidence, Kind, World, Kind, GoalValue, GoalValue])[] = [
  ["closed", "asserted", "if", "closed", "if", "true", "true"],
  ["closed", "asserted", "if", "closed", "iff", "true", "true"],
  ["closed", "asserted", "if", "open", "if", "true", "true"],
  ["closed", "asserted", "if", "open", "iff", "true", "true"],
  ["closed", "asserted", "iff", "closed", "if", "true", "conflicted"],
  ["closed", "asserted", "iff", "closed", "iff", "true", "conflicted"],
  ["closed", "asserted", "iff", "open", "if", "true", "true"],
  ["closed", "asserted", "iff", "open", "iff", "true", "true"],
  ["closed", "both", "if", "closed", "if", "conflicted", "conflicted"],
  ["closed", "both", "if", "closed", "iff", "conflicted", "conflicted"],
  ["closed", "both", "if", "open", "if", "conflicted", "conflicted"],
  ["closed", "both", "if", "open", "iff", "conflicted", "conflicted"],
  ["closed", "both", "iff", "closed", "if", "conflicted", "conflicted"],
  ["closed", "both", "iff", "closed", "iff", "conflicted", "conflicted"],
  ["closed", "both", "iff", "open", "if", "conflicted", "conflicted"],
  ["closed", "both", "iff", "open", "iff", "conflicted", "conflicted"],
  ["closed", "denied", "if", "closed", "if", "false", "unknown"],
  ["closed", "denied", "if", "closed", "iff", "false", "false"],
  ["closed", "denied", "if", "open", "if", "false", "unknown"],
  ["closed", "denied", "if", "open", "iff", "false", "false"],
  ["closed", "denied", "iff", "closed", "if", "false", "unknown"],
  ["closed", "denied", "iff", "closed", "iff", "false", "false"],
  ["closed", "denied", "iff", "open", "if", "false", "unknown"],
  ["closed", "denied", "iff", "open", "iff", "false", "false"],
  ["closed", "none", "if", "open", "if", "unknown", "unknown"],
  ["closed", "none", "if", "open", "iff", "unknown", "unknown"],
  ["closed", "none", "iff", "open", "if", "unknown", "unknown"],
  ["closed", "none", "iff", "open", "iff", "false", "unknown"],
  ["open", "asserted", "if", "closed", "if", "true", "true"],
  ["open", "asserted", "if", "closed", "iff", "true", "true"],
  ["open", "asserted", "if", "open", "if", "true", "true"],
  ["open", "asserted", "if", "open", "iff", "true", "true"],
  ["open", "asserted", "iff", "closed", "if", "true", "conflicted"],
  ["open", "asserted", "iff", "closed", "iff", "true", "conflicted"],
  ["open", "asserted", "iff", "open", "if", "true", "true"],
  ["open", "asserted", "iff", "open", "iff", "true", "true"],
  ["open", "both", "if", "closed", "if", "conflicted", "conflicted"],
  ["open", "both", "if", "closed", "iff", "conflicted", "conflicted"],
  ["open", "both", "if", "open", "if", "conflicted", "conflicted"],
  ["open", "both", "if", "open", "iff", "conflicted", "conflicted"],
  ["open", "both", "iff", "closed", "if", "conflicted", "conflicted"],
  ["open", "both", "iff", "closed", "iff", "conflicted", "conflicted"],
  ["open", "both", "iff", "open", "if", "conflicted", "conflicted"],
  ["open", "both", "iff", "open", "iff", "conflicted", "conflicted"],
  ["open", "denied", "if", "closed", "if", "false", "unknown"],
  ["open", "denied", "if", "closed", "iff", "false", "false"],
  ["open", "denied", "if", "open", "if", "false", "unknown"],
  ["open", "denied", "if", "open", "iff", "false", "false"],
  ["open", "denied", "iff", "closed", "if", "false", "unknown"],
  ["open", "denied", "iff", "closed", "iff", "false", "false"],
  ["open", "denied", "iff", "open", "if", "false", "unknown"],
  ["open", "denied", "iff", "open", "iff", "false", "false"],
  ["open", "none", "if", "closed", "if", "unknown", "unknown"],
  ["open", "none", "if", "closed", "iff", "unknown", "unknown"],
  ["open", "none", "if", "open", "if", "unknown", "unknown"],
  ["open", "none", "if", "open", "iff", "unknown", "unknown"],
  ["open", "none", "iff", "closed", "if", "unknown", "unknown"],
  ["open", "none", "iff", "closed", "iff", "unknown", "false"],
  ["open", "none", "iff", "open", "if", "unknown", "unknown"],
  ["open", "none", "iff", "open", "iff", "unknown", "unknown"],
];

describe("query", () => {
  it.each(PINNED)(
    "preserves a:%s:%s %s b; b:%s %s a as %s/%s",
    (worldA, evidenceA, kindA, worldB, kindB, valueA, valueB) => {
      // Arrange
      const program: Program = {
        worlds: { a: worldA, b: worldB },
        evidence: { a: evidenceA },
        rules: [
          { head: "a", kind: kindA, body: "b" },
          { head: "b", kind: kindB, body: "a" },
        ],
      };
      for (const order of permutations(2)) {
        const { kb, atoms } = build(program, order, "assert-first");
        // Act
        const actual = [...atoms.values()].map((atom) => query(kb, atom({ p: x })).value);
        // Assert
        expect(actual).toEqual([valueA, valueB]);
      }
    },
  );
});
