import type { Formula, NumericTerm, DateTerm } from "./index";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  add,
  sub,
  mul,
  div,
  sum,
  count,
  gt,
  gte,
  lte,
  eq,
  neq,
  letIn,
  variable,
  predicate,
  closedPredicate,
} from "./index";

describe("number-only DSL", () => {
  it("rejects bigint predicate schemas and field values", () => {
    // Arrange
    const amount = predicate("amount", { value: Number });
    // Act / Assert
    for (const declare of [predicate, closedPredicate]) {
      // @ts-expect-error BigInt is not a supported schema constructor.
      expect(() => declare("big", { value: BigInt })).toThrow("bigint is not supported");
    }
    // @ts-expect-error Bigint is not a number field value.
    expect(() => amount({ value: 1n })).toThrow("bigint is not supported");
  });

  it("rejects bigint arithmetic and comparison operands without coercing them", () => {
    // Arrange
    const operators = [add, sub, mul, div, gt, gte, lte, eq, neq];
    // Act / Assert
    for (const operator of operators) {
      // @ts-expect-error Bigint operands are unsupported.
      expect(() => operator(1n, 2)).toThrow("bigint is not supported");
      // @ts-expect-error Bigint operands are unsupported.
      expect(() => operator(1, 2n)).toThrow("bigint is not supported");
    }
  });

  it("rejects bigint aggregate terms and let values", () => {
    // Arrange
    const X = variable("X");
    // Act / Assert
    // @ts-expect-error Bigint terms are unsupported.
    expect(() => sum(1n)).toThrow("bigint is not supported");
    // @ts-expect-error Bigint terms are unsupported.
    expect(() => count(1n)).toThrow("bigint is not supported");
    // @ts-expect-error Bigint values are unsupported.
    expect(() => letIn(X, 1n, gte(X, 0))).toThrow("bigint is not supported");
  });

  it("infers number arithmetic and preserves date subtraction", () => {
    // Arrange / Act
    const numberResult = add(1, 2);
    const dateResult = sub(new Date("2020-01-02"), 86_400_000);
    // Assert
    expectTypeOf(numberResult).toEqualTypeOf<
      Formula<number, readonly [NumericTerm, NumericTerm]>
    >();
    expectTypeOf(dateResult).toEqualTypeOf<Formula<Date, readonly [DateTerm, NumericTerm]>>();
  });
});
