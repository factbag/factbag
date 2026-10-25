import { describe, expect, expectTypeOf, it } from "vitest";
import type { Formula, NumericTerm } from "../types";
import { ceilTo, floorTo, max, min, roundTo } from "./arithmetic";

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
