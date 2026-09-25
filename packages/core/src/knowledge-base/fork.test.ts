import { expect, it } from "vitest";
import { predicate } from "../dsl/predicate";
import { KnowledgeBase } from "./knowledge-base";

it("forks storage while preserving evidence, rules and entity identities", () => {
  class Company {
    constructor(readonly id: string) {}
  }
  const company = new Company("harbor");
  const fact = predicate("fact", { company: Company });
  const result = predicate("result", { company: Company });
  const kb = new KnowledgeBase();
  kb.entities.add(company);
  const evidence = kb.denies(fact({ company }), { source: "record" });
  kb.rule(result({ company })).iff(fact({ company }));
  const fork = kb.fork();

  expect(fork.literals()[0]).toBe(evidence);
  expect(fork.rules()[0]).toBe(kb.rules()[0]);
  expect(fork.entities.all()[0]).toBe(company);
  fork.retract(evidence);
  fork.asserts(fact({ company }));
  const additional = predicate("additional", { company: Company });
  fork.rule(additional({ company })).if(fact({ company }));
  fork.entities.add(new Company("cobalt"));

  expect(kb.literals()).toEqual([evidence]);
  expect(kb.rules()).toHaveLength(1);
  expect(kb.predicates()).toEqual([fact, result]);
  expect(fork.predicates()).toEqual([fact, result, additional]);
  expect(kb.entities.all()).toEqual([company]);
  kb.asserts(additional({ company }));
  expect(fork.literals()).toHaveLength(1);
});
