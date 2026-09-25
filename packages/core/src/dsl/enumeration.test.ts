import { expect, expectTypeOf, it } from "vitest";
import { enumeration } from "./enumeration";
import { predicate } from "./predicate";
import { KnowledgeBase } from "../knowledge-base/knowledge-base";
import { query } from "../query/query";

it("retains literal enum types and immutable explicit values", () => {
  const Status = enumeration("active", "dissolved");
  const status = predicate("status", { value: Status });
  const atom = status({ value: "active" });
  expectTypeOf(atom.fields.value).toEqualTypeOf<"active" | "dissolved">();
  expect(Object.isFrozen(Status)).toBe(true);
  expect(Object.isFrozen(Status.values)).toBe(true);
  expect(Status.values).toEqual(["active", "dissolved"]);
  expect(() => enumeration("active", "active")).toThrow("unique strings");
});

it("leaves enum exclusivity to rules rather than denying other values", () => {
  const status = predicate("status", { value: enumeration("active", "dissolved") });
  const kb = new KnowledgeBase();
  kb.asserts(status({ value: "active" }));
  kb.asserts(status({ value: "dissolved" }));
  expect(query(kb, status({ value: "active" })).value).toBe("true");
  expect(query(kb, status({ value: "dissolved" })).value).toBe("true");
});
