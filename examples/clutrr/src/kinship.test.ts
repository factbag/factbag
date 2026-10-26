/**
 * The rules against small hand-made families, independent of any CLUTRR story: each key's
 * direction, its counterpart, each composition, the provenance of a derived relation and
 * the benchmark's longest clause. Then, when the data is present, the rules against the
 * generator's own account of the training stories: the closure of a story's supporting
 * facts under the rules as transcribed must give the gold label, and the solver must agree.
 */
import { describe, expect, test } from "vitest";
import type { KnowledgeBase } from "@factbag/core/kb";
import { defaultDataDir, hasSplit, loadStories } from "./data";
import type { Story } from "./data";
import {
  closure,
  COMPOSITIONS,
  COUNTERPARTS,
  keyOfLabel,
  keysBetween,
  kinshipKB,
  labelFor,
  RELATION_KEYS,
  relationsBetween,
} from "./kinship";
import type { Gender, RelationKey } from "./kinship";
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

/** State that `b` is `a`'s `key`, with the one fact predicate for it. */
function state(kb: KnowledgeBase, a: Person, key: RelationKey, b: Person): void {
  switch (key) {
    case "child":
      kb.asserts(parent_of({ parent: a, child: b }));
      return;
    case "inv-child":
      kb.asserts(parent_of({ parent: b, child: a }));
      return;
    case "SO":
      kb.asserts(spouse_of({ a, b }));
      return;
    case "sibling":
      kb.asserts(sibling_of({ a, b }));
      return;
    case "grand":
      kb.asserts(grandparent_of({ grandparent: a, grandchild: b }));
      return;
    case "inv-grand":
      kb.asserts(grandparent_of({ grandparent: b, grandchild: a }));
      return;
    case "in-law":
      kb.asserts(parent_in_law_of({ parent_in_law: a, child_in_law: b }));
      return;
    case "inv-in-law":
      kb.asserts(parent_in_law_of({ parent_in_law: b, child_in_law: a }));
      return;
    case "sibling-in-law":
      kb.asserts(sibling_in_law_of({ a, b }));
      return;
    case "un":
      kb.asserts(uncle_or_aunt_of({ uncle_or_aunt: a, nibling: b }));
      return;
    case "inv-un":
      kb.asserts(uncle_or_aunt_of({ uncle_or_aunt: b, nibling: a }));
  }
}

function family(...names: readonly string[]): {
  kb: KnowledgeBase;
  p: (name: string) => Person;
} {
  const kb = kinshipKB();
  const people = new Map(names.map((name) => [name, new Person(name)]));
  kb.entities.add(...people.values());
  return {
    kb,
    p: (name) => {
      const person = people.get(name);
      if (person === undefined) {
        throw new Error(`No ${name} in the family`);
      }
      return person;
    },
  };
}

function keys(kb: KnowledgeBase, a: Person, b: Person): readonly RelationKey[] {
  return relationsBetween(kb, a, b)
    .map((derived) => derived.key)
    .sort((x, y) => x.localeCompare(y));
}

describe("one stated fact", () => {
  test.each(RELATION_KEYS)("%s reads in its own direction and its counterpart's", (key) => {
    const { kb, p } = family("A", "B");
    state(kb, p("A"), key, p("B"));
    expect(keys(kb, p("A"), p("B"))).toEqual([key]);
    // The rules file gives sibling-in-law no counterpart, but the fact predicate for it is
    // unordered, so the stated fact itself reads in both directions.
    const counterpart = COUNTERPARTS[key] ?? (key === "sibling-in-law" ? key : undefined);
    expect(keys(kb, p("B"), p("A"))).toEqual(counterpart === undefined ? [] : [counterpart]);
  });

  test("rests on that fact alone", () => {
    const { kb, p } = family("Kristin", "Justin");
    state(kb, p("Kristin"), "child", p("Justin"));
    const [derived] = relationsBetween(kb, p("Justin"), p("Kristin"));
    expect(derived?.key).toBe("inv-child");
    expect(derived?.stated).toHaveLength(1);
    expect(derived?.stated[0]).toContain("parent_of");
  });

  test("nobody is related to themselves, and strangers are unrelated", () => {
    const { kb, p } = family("A", "B", "C");
    state(kb, p("A"), "sibling", p("B"));
    expect(keys(kb, p("A"), p("A"))).toEqual([]);
    expect(keys(kb, p("B"), p("B"))).toEqual([]);
    expect(keys(kb, p("A"), p("C"))).toEqual([]);
    expect(keys(kb, p("C"), p("A"))).toEqual([]);
  });
});

describe("compositions", () => {
  test.each(COMPOSITIONS)("(%s, %s) gives %s, resting on both facts", (first, second, result) => {
    const { kb, p } = family("A", "X", "B");
    state(kb, p("A"), first, p("X"));
    state(kb, p("X"), second, p("B"));
    const derived = relationsBetween(kb, p("A"), p("B"));
    expect(derived.map((entry) => entry.key)).toContain(result);
    const found = derived.find((entry) => entry.key === result);
    expect(found?.stated).toHaveLength(2);
    // The counterpart of the result is read back the other way.
    const counterpart = COUNTERPARTS[result];
    if (counterpart !== undefined) {
      expect(keys(kb, p("B"), p("A"))).toContain(counterpart);
    }
  });

  test("the paper's example: Kristin's son Justin and her mother Carol", () => {
    const { kb, p } = family("Kristin", "Justin", "Carol");
    state(kb, p("Kristin"), "child", p("Justin"));
    state(kb, p("Kristin"), "inv-child", p("Carol"));
    const [derived] = relationsBetween(kb, p("Justin"), p("Carol"));
    expect(derived?.key).toBe("inv-grand");
    expect(labelFor("inv-grand", "female")).toBe("grandmother");
    expect(derived?.stated).toHaveLength(2);
  });

  test("a composition's inputs may themselves be derived", () => {
    // Alan's daughter Annie, Annie's uncle James, James's son Anthony: Anthony is Alan's nephew.
    const { kb, p } = family("Alan", "Annie", "James", "Anthony");
    state(kb, p("Alan"), "child", p("Annie"));
    state(kb, p("Annie"), "inv-un", p("James"));
    state(kb, p("James"), "child", p("Anthony"));
    expect(keys(kb, p("Alan"), p("Anthony"))).toEqual(["un"]);
    expect(keys(kb, p("Anthony"), p("Alan"))).toEqual(["inv-un"]);
  });

  // Slower than vitest's default allowance on a CI runner, hence the explicit timeout.
  test(
    "the benchmark's longest clause, ten supporting facts, resolves in seconds",
    { timeout: 30_000 },
    () => {
      // Nine siblings in a row, then a child: the last is the first's nephew.
      const names = Array.from({ length: 11 }, (_, index) => `P${String(index)}`);
      const { kb, p } = family(...names);
      for (let index = 0; index < 9; index += 1) {
        state(kb, p(names[index] ?? ""), "sibling", p(names[index + 1] ?? ""));
      }
      state(kb, p("P9"), "child", p("P10"));
      const began = performance.now();
      expect(keys(kb, p("P0"), p("P10"))).toEqual(["un"]);
      expect(keys(kb, p("P10"), p("P0"))).toEqual(["inv-un"]);
      expect(performance.now() - began).toBeLessThan(20_000);
    },
  );
});

const dataDir = defaultDataDir();

describe.skipIf(!hasSplit(dataDir, "train"))("the generator's own training proofs", () => {
  const stories = dataDir === undefined ? [] : loadStories(dataDir, "train");

  function keyed(story: Story): readonly (readonly [string, string, RelationKey])[] {
    return story.edges.map(([from, label, to]) => [from, to, keyOfLabel(label).key] as const);
  }

  function gender(story: Story, name: string): Gender {
    const found = story.genders[name];
    if (found !== "male" && found !== "female") {
      throw new Error(`${story.id}: no gender for ${name}`);
    }
    return found;
  }

  test("the rules as transcribed close every proof to its gold label", () => {
    expect(stories.length).toBeGreaterThan(0);
    const missing: string[] = [];
    const ambiguous: string[] = [];
    for (const story of stories) {
      const [first, second] = story.query;
      const found = keysBetween(closure(keyed(story)), first, second);
      const labels = found.map((key) => labelFor(key, gender(story, second)));
      if (!labels.includes(story.target)) {
        missing.push(`${story.id}: ${labels.join("|")} for ${story.target}`);
      } else if (labels.length > 1) {
        ambiguous.push(story.id);
      }
    }
    expect(missing).toEqual([]);
    // The benchmark's rules themselves derive two keys for some pairs: a spouse's child's
    // grandparent is read both as a parent (child, inv-grand) and as a parent-in-law
    // (SO, inv-child), and the gold label follows the path the generator happened to take.
    // Such stories have no unique answer under the rules; this is their count in training.
    expect(ambiguous).toHaveLength(106);
  });

  test("the solver agrees with the closure, and both reach the gold label, on a sample", () => {
    const lengths = [...new Set(stories.map((story) => story.length))];
    const sample = lengths.flatMap((length) =>
      stories.filter((story) => story.length === length).slice(0, 25),
    );
    for (const story of sample) {
      const names = [...new Set(story.edges.flatMap(([from, , to]) => [from, to]))];
      const { kb, p } = family(...names);
      for (const [from, to, key] of keyed(story)) {
        state(kb, p(from), key, p(to));
      }
      const [first, second] = story.query;
      const derived = relationsBetween(kb, p(first), p(second));
      const expected = [...keysBetween(closure(keyed(story)), first, second)].sort();
      expect(derived.map((entry) => entry.key).sort()).toEqual(expected);
      expect(derived.map((entry) => labelFor(entry.key, gender(story, second)))).toContain(
        story.target,
      );
      for (const entry of derived) {
        expect(entry.stated.length).toBeGreaterThan(0);
        expect(entry.stated.length).toBeLessThanOrEqual(story.length);
      }
    }
  });
});
