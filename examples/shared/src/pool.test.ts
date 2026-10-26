import { describe, expect, it, vi } from "vitest";
import { pool } from "./pool";

describe("pool", () => {
  it("runs every item once with at most the given number in flight", async () => {
    // Arrange
    const items = [1, 2, 3, 4, 5];
    const seen: number[] = [];
    let inFlight = 0;
    let peak = 0;

    // Act
    await pool(items, 2, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      seen.push(item);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      inFlight -= 1;
    });

    // Assert
    expect([...seen].sort((a, b) => a - b)).toEqual(items);
    expect(peak).toBe(2);
  });

  it("passes each item's index and resolves when the list is empty", async () => {
    // Arrange
    const indices: number[] = [];

    // Act
    await pool(["a", "b"], 4, async (_item, index) => {
      indices.push(index);
      await Promise.resolve();
    });
    const never = vi.fn(async () => {
      await Promise.resolve();
    });
    await pool([], 4, never);

    // Assert
    expect(indices).toEqual([0, 1]);
    expect(never).not.toHaveBeenCalled();
  });
});
