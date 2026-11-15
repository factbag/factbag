/**
 * Asserts that the shared assertion helper throws a stable AssertionError when
 * an internal invariant fails.
 */
import { describe, expect, it } from "vitest";
import { assert, AssertionError } from "./assert";

describe("assert", () => {
  it("does nothing when the condition is truthy", () => {
    expect(() => assert(true)).not.toThrow();
  });

  it("throws AssertionError when the condition is falsey", () => {
    expect(() => assert(false, "Nope")).toThrow(AssertionError);
    expect(() => assert(false, "Nope")).toThrow("Nope");
  });
});
