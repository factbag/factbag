import { predicate, variable, type Predicate, type Var } from "../../src/dsl";
import type { Entity } from "../../src/dsl/types";

/** ## Entities */
export class NaturalPerson implements Entity {
  constructor(readonly id: string) {}
}

export class Year implements Entity {
  constructor(readonly id: string) {}
}

export const alice: NaturalPerson = new NaturalPerson("alice");
export const y2024: Year = new Year("2024");
export const y2023: Year = new Year("2023");

/**
 * ## Predicates
 *
 * `incomeFact` rows feed the aggregate. `incomeReviewComplete` is not another
 * income row; it records that the reviewed income record is complete enough for
 * threshold reasoning.
 */
export const incomeFact: Predicate<{
  person: typeof NaturalPerson;
  year: typeof Year;
  amountCents: NumberConstructor;
}> = predicate("income_fact", {
  person: NaturalPerson,
  year: Year,
  amountCents: Number,
});
export const incomeReviewComplete: Predicate<{
  person: typeof NaturalPerson;
  year: typeof Year;
}> = predicate("income_review_complete", {
  person: NaturalPerson,
  year: Year,
});
export const annualIncomeOver200k: Predicate<{
  person: typeof NaturalPerson;
  year: typeof Year;
}> = predicate("annual_income_over_200k", {
  person: NaturalPerson,
  year: Year,
});
export const multipleIncomeSources: Predicate<{
  person: typeof NaturalPerson;
}> = predicate("multiple_income_sources", {
  person: NaturalPerson,
});

/** ## Variables */
export const Amount: Var<"Amount"> = variable("Amount");
export const Total: Var<"Total"> = variable("Total");
export const Count: Var<"Count"> = variable("Count");
