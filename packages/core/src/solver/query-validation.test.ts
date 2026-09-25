/**
 * Asserts the query validation entrypoint accepts the current solver inputs and
 * remains a non-mutating seam for future admissibility checks.
 */
import { describe, expect, it } from "vitest";
import { predicate } from "../dsl";
import { validateQuery } from "./query-validation";

class Person {
  constructor(readonly id: string) {}
}

describe("query validation", () => {
  it("accepts literals, rules, and a query atom", () => {
    const alice = new Person("alice");
    const eligible = predicate("eligible", { person: Person });
    const literal = { sign: "+", atom: eligible({ person: alice }) } as const;

    expect(() => validateQuery([literal], [], eligible({ person: alice }))).not.toThrow();
  });
});
