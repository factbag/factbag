/**
 * CLUTRR's kinship rules as Factbag rules, written from the benchmark's documented
 * semantics (`clutrr/store/rules_store.yaml` in the released generator) and from nothing
 * else. The benchmark names eleven relation keys, each read along an edge: an edge
 * (a, child, b) says b is a's child. Two keys are symmetric (sibling, SO), the others come
 * in inverse pairs, and sixteen compositional rules say what a path of two edges amounts
 * to: (a, child, x) and (x, child, b) give (a, grand, b). The generator applies those rules
 * recursively to a family graph; these rules apply them, recursively, to the facts Jev
 * extracts.
 *
 * Each key is one derived predicate over an ordered pair, with one sufficient-condition
 * rule for each way it arises: what the story states for it, its counterpart read the
 * other way round, and every composition that yields it. The eleven predicates are mutually
 * recursive; they are closed-world and never asserted, so the solver tables them as one
 * component and judges their atoms as a least fixed point (`docs/formalized/recursion.md`).
 * The rules are `if`, not `iff`: a relation the rules derive is true, one they do not is
 * unknown rather than denied, which is all the evaluation asks. (An `iff` definition of a
 * recursive predicate cannot be queried with a free variable, since the query validation
 * wants a base rule whose body stays out of the component; and a ground `iff` query of one
 * key costs about eight times a query of all keys in this form.)
 *
 * Explicitly stated facts live only in the fact predicates of `schema.ts`; the derived
 * predicates are never asserted, so a judgment's explanation separates what was read from
 * what was reasoned: its evidence leaves are the stated facts the answer rests on.
 */
import { and, closedPredicate, enumeration, eq, letIn, neq, or, variable } from "@factbag/core/dsl";
import type { Atom, ClosedWorldPredicate, Formula } from "@factbag/core/dsl";
import type { Explanation } from "@factbag/core/explain";
import { explainJudgment } from "@factbag/core/explain";
import { KnowledgeBase } from "@factbag/core/kb";
import { queryAll } from "@factbag/core/query";
import {
  grandparent_of,
  parent_in_law_of,
  parent_of,
  Person,
  sibling_in_law_of,
  sibling_of,
  spouse_of,
  uncle_or_aunt_of,
} from "./schema";

/** The benchmark's relation keys, as its rules file spells them. */
export type RelationKey =
  | "child"
  | "inv-child"
  | "SO"
  | "sibling"
  | "grand"
  | "inv-grand"
  | "in-law"
  | "inv-in-law"
  | "sibling-in-law"
  | "un"
  | "inv-un";

export const RELATION_KEYS = [
  "child",
  "inv-child",
  "SO",
  "sibling",
  "grand",
  "inv-grand",
  "in-law",
  "inv-in-law",
  "sibling-in-law",
  "un",
  "inv-un",
] as const satisfies readonly RelationKey[];

const KEYS = enumeration(...RELATION_KEYS);

export type Gender = "male" | "female";

/**
 * The benchmark's gendered names for each key, as the label of `b` when (a, key, b) holds:
 * b is a's son, or daughter.
 */
const LABELS: Readonly<Record<RelationKey, Readonly<Record<Gender, string>>>> = {
  child: { male: "son", female: "daughter" },
  "inv-child": { male: "father", female: "mother" },
  SO: { male: "husband", female: "wife" },
  sibling: { male: "brother", female: "sister" },
  grand: { male: "grandson", female: "granddaughter" },
  "inv-grand": { male: "grandfather", female: "grandmother" },
  "in-law": { male: "son-in-law", female: "daughter-in-law" },
  "inv-in-law": { male: "father-in-law", female: "mother-in-law" },
  "sibling-in-law": { male: "brother-in-law", female: "sister-in-law" },
  un: { male: "nephew", female: "niece" },
  "inv-un": { male: "uncle", female: "aunt" },
};

/** Every label the rules can produce, in key order: the answer set of both systems. */
export const ALL_LABELS: readonly string[] = RELATION_KEYS.flatMap((key) => [
  LABELS[key].male,
  LABELS[key].female,
]);

export function labelFor(key: RelationKey, gender: Gender): string {
  return LABELS[key][gender];
}

/** The key and gender a label stands for: "aunt" is inv-un, female. */
export function keyOfLabel(label: string): Readonly<{ key: RelationKey; gender: Gender }> {
  for (const key of RELATION_KEYS) {
    for (const gender of ["male", "female"] as const) {
      if (LABELS[key][gender] === label) {
        return { key, gender };
      }
    }
  }
  throw new Error(`Not a kinship label: ${label}`);
}

/**
 * The compositional rules, verbatim from the rules file: (first, second) gives result, for
 * a path (a, first, x), (x, second, b).
 */
export const COMPOSITIONS: readonly (readonly [RelationKey, RelationKey, RelationKey])[] = [
  ["child", "child", "grand"],
  ["child", "SO", "in-law"],
  ["child", "sibling", "child"],
  ["child", "inv-un", "sibling"],
  ["child", "inv-grand", "inv-child"],
  ["inv-child", "child", "sibling"],
  ["inv-child", "inv-child", "inv-grand"],
  ["inv-child", "sibling", "inv-un"],
  ["SO", "inv-child", "inv-in-law"],
  ["SO", "grand", "grand"],
  ["SO", "child", "child"],
  ["sibling", "sibling", "sibling"],
  ["sibling", "inv-grand", "inv-grand"],
  ["sibling", "child", "un"],
  ["sibling", "inv-child", "inv-child"],
  ["grand", "sibling", "grand"],
];

/** The symmetric keys, and the inverse pairs, from the rules file. */
export const COUNTERPARTS: Readonly<Record<RelationKey, RelationKey | undefined>> = {
  sibling: "sibling",
  SO: "SO",
  child: "inv-child",
  "inv-child": "child",
  grand: "inv-grand",
  "inv-grand": "grand",
  un: "inv-un",
  "inv-un": "un",
  "in-law": "inv-in-law",
  "inv-in-law": "in-law",
  "sibling-in-law": undefined,
};

type Derivable = ClosedWorldPredicate<{ a: typeof Person; b: typeof Person }>;

function derivable(key: RelationKey): Derivable {
  return closedPredicate(`rel_${key.replaceAll("-", "_")}`, { a: Person, b: Person });
}

/** One derived predicate per key: `rel_child(a, b)` holds when b is a's child. */
export const RELATIONS: Readonly<Record<RelationKey, Derivable>> = {
  child: derivable("child"),
  "inv-child": derivable("inv-child"),
  SO: derivable("SO"),
  sibling: derivable("sibling"),
  grand: derivable("grand"),
  "inv-grand": derivable("inv-grand"),
  "in-law": derivable("in-law"),
  "inv-in-law": derivable("inv-in-law"),
  "sibling-in-law": derivable("sibling-in-law"),
  un: derivable("un"),
  "inv-un": derivable("inv-un"),
};

/** (a, key, b) holds under the rules: b is a's `key`. One query per pair reads every key. */
const relation = closedPredicate("relation", { a: Person, b: Person, key: KEYS });

const A = variable("A");
const B = variable("B");
const X = variable("X");
const K = variable("K");

/** A fact atom, or a formula over atoms. */
type Alternative = Atom | Formula<boolean, readonly unknown[]>;

/**
 * What the story's fact predicates state for each key. An inverse pair is one fact
 * predicate read in both directions; a symmetric relation is one fact predicate in either
 * order.
 */
const STATED: Readonly<Record<RelationKey, readonly Alternative[]>> = {
  child: [parent_of({ parent: A, child: B })],
  "inv-child": [parent_of({ parent: B, child: A })],
  SO: [spouse_of({ a: A, b: B }), spouse_of({ a: B, b: A })],
  sibling: [sibling_of({ a: A, b: B }), sibling_of({ a: B, b: A })],
  grand: [grandparent_of({ grandparent: A, grandchild: B })],
  "inv-grand": [grandparent_of({ grandparent: B, grandchild: A })],
  "in-law": [parent_in_law_of({ parent_in_law: A, child_in_law: B })],
  "inv-in-law": [parent_in_law_of({ parent_in_law: B, child_in_law: A })],
  "sibling-in-law": [sibling_in_law_of({ a: A, b: B }), sibling_in_law_of({ a: B, b: A })],
  un: [uncle_or_aunt_of({ uncle_or_aunt: A, nibling: B })],
  "inv-un": [uncle_or_aunt_of({ uncle_or_aunt: B, nibling: A })],
};

function defineKinship(kb: KnowledgeBase): void {
  for (const key of RELATION_KEYS) {
    const head = RELATIONS[key]({ a: A, b: B });
    // Nobody is related to themselves: a path that returns to its start proves nothing.
    // The comparison comes after the atoms that bind its operands.
    for (const fact of STATED[key]) {
      kb.rule(head).if(and(fact, neq(A, B)));
    }
    const counterpart = COUNTERPARTS[key];
    if (counterpart !== undefined) {
      kb.rule(head).if(RELATIONS[counterpart]({ a: B, b: A }));
    }
    for (const [first, second, result] of COMPOSITIONS) {
      if (result === key) {
        kb.rule(head).if(
          and(RELATIONS[first]({ a: A, b: X }), RELATIONS[second]({ a: X, b: B }), neq(A, B)),
        );
      }
    }
  }
  kb.rule(relation({ a: A, b: B, key: K })).iff(
    or(...RELATION_KEYS.map((key) => and(RELATIONS[key]({ a: A, b: B }), letIn(K, key, eq(K, K))))),
  );
}

/** A knowledge base holding the kinship rules and nothing else. */
export function kinshipKB(): KnowledgeBase {
  const kb = new KnowledgeBase();
  defineKinship(kb);
  return kb;
}

export type Derived = Readonly<{
  key: RelationKey;
  /** The stated facts the derivation rests on, as the explanation's evidence claims. */
  stated: readonly string[];
}>;

/** Every relation the rules derive from a to b: how b is related to a, with its grounds. */
export function relationsBetween(kb: KnowledgeBase, a: Person, b: Person): readonly Derived[] {
  return queryAll(kb, relation({ a, b, key: K }))
    .filter((judgment) => judgment.value === "true")
    .map((judgment) => {
      const key = judgment.goal.atom.fields["key"];
      if (!isRelationKey(key)) {
        throw new Error(`Not a relation key: ${String(key)}`);
      }
      return { key, stated: evidenceClaims(explainJudgment(judgment)) };
    });
}

function isRelationKey(value: unknown): value is RelationKey {
  return typeof value === "string" && (RELATION_KEYS as readonly string[]).includes(value);
}

/** The claims of an explanation's evidence leaves, each once, in order of appearance. */
function evidenceClaims(explanation: Explanation): readonly string[] {
  const claims: string[] = [];
  const walk = (node: Explanation): void => {
    if ("given" in node) {
      for (const child of node.given) {
        walk(child);
      }
      return;
    }
    if ("because" in node && typeof node.because === "object") {
      if (!claims.includes(node.claim)) {
        claims.push(node.claim);
      }
    }
  };
  walk(explanation);
  return claims;
}

/**
 * The benchmark's rules applied directly to a set of keyed edges, without the solver: the
 * closure of the edges under the counterpart and composition rules. This is the generator's
 * own computation, used to check the data's gold labels against the rules as transcribed;
 * the evaluation itself never uses it.
 */
export function closure(
  edges: readonly (readonly [from: string, to: string, key: RelationKey])[],
): ReadonlyMap<string, ReadonlySet<RelationKey>> {
  const relations = new Map<string, Set<RelationKey>>();
  const add = (from: string, to: string, key: RelationKey): boolean => {
    if (from === to) {
      return false;
    }
    const id = `${from}\u0000${to}`;
    let keys = relations.get(id);
    if (keys === undefined) {
      keys = new Set();
      relations.set(id, keys);
    }
    if (keys.has(key)) {
      return false;
    }
    keys.add(key);
    return true;
  };
  for (const [from, to, key] of edges) {
    add(from, to, key);
  }
  const people = [...new Set(edges.flatMap(([from, to]) => [from, to]))];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, keys] of [...relations]) {
      const [from, to] = id.split("\u0000");
      if (from === undefined || to === undefined) {
        throw new Error("unreachable: ids are pairs");
      }
      for (const key of [...keys]) {
        const counterpart = COUNTERPARTS[key];
        if (counterpart !== undefined && add(to, from, counterpart)) {
          changed = true;
        }
      }
    }
    for (const a of people) {
      for (const b of people) {
        if (compose(relations, people, a, b, add)) {
          changed = true;
        }
      }
    }
  }
  return relations;
}

/** Apply every composition along a path a, x, b for some x; whether anything was new. */
function compose(
  relations: ReadonlyMap<string, ReadonlySet<RelationKey>>,
  people: readonly string[],
  a: string,
  b: string,
  add: (from: string, to: string, key: RelationKey) => boolean,
): boolean {
  let changed = false;
  for (const x of people) {
    const first = relations.get(`${a}\u0000${x}`);
    const second = relations.get(`${x}\u0000${b}`);
    if (first === undefined || second === undefined) {
      continue;
    }
    for (const [one, two, result] of COMPOSITIONS) {
      if (first.has(one) && second.has(two) && add(a, b, result)) {
        changed = true;
      }
    }
  }
  return changed;
}

/** The keys the closure holds from a to b. */
export function keysBetween(
  relations: ReadonlyMap<string, ReadonlySet<RelationKey>>,
  a: string,
  b: string,
): readonly RelationKey[] {
  return [...(relations.get(`${a}\u0000${b}`) ?? [])];
}
