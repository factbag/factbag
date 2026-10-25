import { describe, expect, expectTypeOf, it } from "vitest";
import { daysBetween, gte, letIn, mul, sub, variable, yearsBetween } from "../index";
import type { DateTerm, Formula, NumericTerm } from "../types";
import { ceilTo, floorTo, max, min, roundTo } from "./arithmetic";

describe("sub", () => {
  it("infers numeric subtraction on a variable inside nested arithmetic", () => {
    // Arrange
    const I = variable("I");
    const A = variable("A");
    // Act
    const difference = sub(I, 1);
    const body = letIn(A, mul(difference, 2), gte(A, 0));
    // Assert
    expectTypeOf(difference).toEqualTypeOf<Formula<number, readonly [NumericTerm, NumericTerm]>>();
    expectTypeOf(body.kind).toEqualTypeOf<string>();
  });
});

for (const operator of [daysBetween, yearsBetween]) {
  describe(operator.name, () => {
    it("accepts date terms and produces number-valued formulas", () => {
      // Arrange
      const D = variable("D");
      const day = new Date("2020-01-02");
      // Act
      const result = operator(sub(day, 1), D);
      // Assert
      expectTypeOf(result).toEqualTypeOf<Formula<number, readonly [DateTerm, DateTerm]>>();
      expect(result).toEqual({ kind: operator.name, args: [sub(day, 1), D] });
      // @ts-expect-error Numbers are not date terms.
      operator(1, day);
      // @ts-expect-error Numeric formulas are not date terms.
      operator(day, mul(1, 2));
    });

    it("rejects bigint operands without coercing them", () => {
      // Arrange
      const day = new Date("2020-01-02");
      // Act / Assert
      // @ts-expect-error Bigint operands are unsupported.
      expect(() => operator(1n, day)).toThrow("bigint is not supported");
      // @ts-expect-error Bigint operands are unsupported.
      expect(() => operator(day, 1n)).toThrow("bigint is not supported");
    });
  });
}
describe.each([min, max, roundTo, floorTo, ceilTo])("%s", (operator) => {
  it("constructs a number-valued formula with both operands", () => {
    // Arrange
    const left = 118;
    const right = 2;

    // Act
    const formula = operator(left, right);

    // Assert
    expect(formula).toEqual({ kind: operator.name, args: [left, right] });
    expectTypeOf(formula).toExtend<Formula<number, readonly [NumericTerm, NumericTerm]>>();
  });

  it.each([0, 1])("rejects bigint in operand %s without coercion", (index) => {
    // Arrange
    const operands: [NumericTerm, NumericTerm] = [10, 0];
    // @ts-expect-error -- Simulate an untyped JavaScript caller supplying a removed scalar type.
    operands[index] = 1n;

    // Act
    const construct = () => operator(...operands);

    // Assert
    expect(construct).toThrow(TypeError);
  });
});
