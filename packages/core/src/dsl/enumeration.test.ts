import { describe, expect, expectTypeOf, it } from "vitest";
import { enumeration } from "./enumeration";
import { predicate } from "./predicate";
import { KnowledgeBase } from "../knowledge-base/knowledge-base";
import { query } from "../query/query";
import type { EnumType, InferRuntime } from "../types/schema";

describe("enumeration", () => {
  it("retains string literals and freezes the domain and its values", () => {
    // Arrange / Act
    const Status = enumeration("active", "dissolved");
    const status = predicate("status", { value: Status });
    const atom = status({ value: "active" });
    // Assert
    expectTypeOf(atom.fields.value).toEqualTypeOf<"active" | "dissolved">();
    expectTypeOf<InferRuntime<typeof Status>>().toEqualTypeOf<"active" | "dissolved">();
    expect(Object.isFrozen(Status)).toBe(true);
    expect(Object.isFrozen(Status.values)).toBe(true);
    expect(Status.values).toEqual(["active", "dissolved"]);
  });

  it("retains number literals as plain numeric field values", () => {
    // Arrange / Act
    const Year = enumeration(2017, 2018);
    const year = predicate("year", { value: Year });
    const atom = year({ value: 2018 });
    // Assert
    expectTypeOf<InferRuntime<typeof Year>>().toEqualTypeOf<2017 | 2018>();
    expectTypeOf(atom.fields.value).toEqualTypeOf<2017 | 2018>();
    expect(Year.values).toEqual([2017, 2018]);
    expect(Object.isFrozen(Year)).toBe(true);
    expect(Object.isFrozen(Year.values)).toBe(true);
  });

  it("copies date members without aliasing caller-owned dates", () => {
    // Arrange
    const first = new Date("2017-01-01");
    const second = new Date("2018-01-01");
    // Act
    const Day = enumeration(first, second);
    first.setTime(0);
    second.setUTCFullYear(2020);
    const day = predicate("day", { value: Day });
    const atom = day({ value: new Date("2017-01-01") });
    // Assert
    expectTypeOf<InferRuntime<typeof Day>>().toEqualTypeOf<Date>();
    expectTypeOf(atom.fields.value).toEqualTypeOf<Date>();
    expect(Day.values).toEqual([new Date("2017-01-01"), new Date("2018-01-01")]);
    expect(Day.values[0]).not.toBe(first);
    expect(Day.values[1]).not.toBe(second);
    expect(Object.isFrozen(Day)).toBe(true);
    expect(Object.isFrozen(Day.values)).toBe(true);
  });

  it.each([
    { name: "strings", values: ["active", "active"] },
    { name: "numbers", values: [2017, 2017] },
    { name: "signed zero", values: [0, -0] },
    { name: "date instants", values: [new Date("2017-01-01"), new Date("2017-01-01T00:00:00Z")] },
  ])("rejects duplicate $name", ({ values }) => {
    // Arrange: the table supplies duplicate values of each supported type.
    // Act / Assert
    // @ts-expect-error Bypass overload selection for the table's union of member types.
    expect(() => enumeration(values[0], ...values.slice(1))).toThrow("unique");
  });

  it.each([
    { name: "NaN", values: [NaN] },
    { name: "a later NaN", values: [1, NaN] },
    { name: "an invalid date", values: [new Date(NaN)] },
    { name: "a later invalid date", values: [new Date("2017-01-01"), new Date(NaN)] },
    { name: "booleans", values: [true] },
    { name: "bigint", values: [1n] },
    { name: "null", values: [null] },
    { name: "undefined", values: [undefined] },
    { name: "objects", values: [{}] },
  ])("rejects $name at runtime", ({ values }) => {
    // Arrange: the table supplies invalid values from an untyped caller.
    // Act / Assert
    // @ts-expect-error Deliberately exercise unsupported runtime inputs.
    expect(() => enumeration(values[0], ...values.slice(1))).toThrow();
  });

  it("rejects mixed member types statically and at runtime", () => {
    // Arrange
    const date = new Date("2017-01-01");
    // Act / Assert
    // @ts-expect-error A domain cannot mix numbers and strings.
    expect(() => enumeration(2017, "2018")).toThrow();
    // @ts-expect-error A domain cannot mix strings and numbers.
    expect(() => enumeration("2017", 2018)).toThrow();
    // @ts-expect-error A domain cannot mix numbers and dates.
    expect(() => enumeration(2017, date)).toThrow();
    // @ts-expect-error A domain cannot mix dates and strings.
    expect(() => enumeration(date, "2018")).toThrow();
    // @ts-expect-error Bigint members are unsupported.
    expect(() => enumeration(1n)).toThrow();
  });

  it("requires a first member rather than inferring an empty domain", () => {
    // Arrange / Act / Assert
    // @ts-expect-error The first member is required.
    expect(() => enumeration()).toThrow();
    expectTypeOf<InferRuntime<EnumType>>().toEqualTypeOf<string | number | Date>();
  });

  it("leaves enum exclusivity to rules rather than denying other values", () => {
    // Arrange
    const status = predicate("status", { value: enumeration("active", "dissolved") });
    const kb = new KnowledgeBase();
    // Act
    kb.asserts(status({ value: "active" }));
    kb.asserts(status({ value: "dissolved" }));
    // Assert
    expect(query(kb, status({ value: "active" })).value).toBe("true");
    expect(query(kb, status({ value: "dissolved" })).value).toBe("true");
  });
});
