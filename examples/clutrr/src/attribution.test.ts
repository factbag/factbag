import { expect, test } from "vitest";
import { attribute, canonical, extractedFacts, goldFacts } from "./attribution";
import type { Story } from "./data";

test("the generator's edges and Jev's facts meet in one spelling", () => {
  expect(canonical("Justin", "inv-child", "Kristin")).toBe("parent_of(Kristin, Justin)");
  expect(canonical("Kristin", "child", "Justin")).toBe("parent_of(Kristin, Justin)");
  expect(canonical("Bob", "SO", "Ann")).toBe("spouse_of(Ann, Bob)");
  expect(canonical("Ann", "SO", "Bob")).toBe("spouse_of(Ann, Bob)");
  expect(goldFacts([["Donald", "father", "Michael"]])).toEqual(["parent_of(Michael, Donald)"]);
  expect(
    extractedFacts([
      { sign: "+", predicate: "sibling_of", fields: { a: "Dorothy", b: "Michael" } },
      { sign: "+", predicate: "sibling_of", fields: { a: "Michael", b: "Dorothy" } },
      { sign: "-", predicate: "parent_of", fields: { parent: "Michael", child: "Donald" } },
      { sign: "+", predicate: "gender", fields: { person: "Donald", gender: "male" } },
    ]),
  ).toEqual(["sibling_of(Dorothy, Michael)"]);
});

const story: Story = {
  id: "s",
  file: "1.2_train.csv",
  text: "Dorothy's brother Michael and her went to get ice cream. Michael is the father of Donald.",
  query: ["Donald", "Dorothy"],
  target: "aunt",
  task: "task_1.2",
  length: 2,
  genders: { Donald: "male", Michael: "male", Dorothy: "female" },
  edges: [
    ["Donald", "father", "Michael"],
    ["Michael", "sister", "Dorothy"],
  ],
};

const full = [
  { sign: "+", predicate: "parent_of", fields: { parent: "Michael", child: "Donald" } },
  { sign: "+", predicate: "sibling_of", fields: { a: "Michael", b: "Dorothy" } },
  { sign: "+", predicate: "gender", fields: { person: "Dorothy", gender: "female" } },
];
const people = ["Dorothy", "Michael", "Donald"];

test("a right answer is attributed to nothing", () => {
  expect(attribute(story, { predicted: "aunt", people, facts: full }).category).toBe("correct");
});

test("a missing gold fact is the extraction's", () => {
  const found = attribute(story, {
    predicted: undefined,
    failure: "no relation derived",
    people,
    facts: full.slice(1),
  });
  expect(found.category).toBe("extraction: gold facts missed");
  expect(found.missed).toEqual(["parent_of(Michael, Donald)"]);
});

test("a wrong gender with the facts complete is the extraction's too", () => {
  const found = attribute(story, {
    predicted: "uncle",
    people,
    facts: [
      ...full.slice(0, 2),
      { sign: "+", predicate: "gender", fields: { person: "Dorothy", gender: "male" } },
    ],
  });
  expect(found.category).toBe("extraction: gender");
  expect(found.genderRight).toBe(false);
});

test("two keys from complete facts are the benchmark's own ambiguity", () => {
  expect(
    attribute(story, {
      predicted: undefined,
      failure: "several relations: inv-un|inv-child",
      people,
      facts: full,
    }).category,
  ).toBe("ambiguous under the benchmark's rules");
});

test("a person the scanner did not find comes first", () => {
  expect(
    attribute(story, {
      predicted: undefined,
      failure: "person not found: Donald",
      people: ["Dorothy", "Michael"],
      facts: [],
    }).category,
  ).toBe("scanner: a named person not found");
});
