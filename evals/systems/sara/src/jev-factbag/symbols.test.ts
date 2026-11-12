import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Person } from "../statute/schema";
import { clairicConfig, people } from "./symbols";

/** Workers AI's answer when it has no capacity. */
const busy = () =>
  Response.json(
    { success: false, errors: [{ code: 3040, message: "Capacity temporarily exceeded" }] },
    { status: 429 },
  );

/** A Workers AI answer naming Alice, for 100 input tokens. */
const named = () =>
  Response.json({
    success: true,
    result: {
      answers: { f0: { type: "list", value: ["Alice"] } },
      usage: { input_tokens: 100, output_tokens: 0 },
    },
  });

/** A fake endpoint that gives `replies` in order, counting the requests it receives. */
function endpoint(...replies: (() => Response)[]) {
  const sent = { count: 0 };
  const fetch: typeof globalThis.fetch = async () => {
    const reply = replies[Math.min(sent.count, replies.length - 1)] ?? named;
    sent.count += 1;
    return await Promise.resolve(reply());
  };
  const usage = { requests: 0, inputTokens: 0 };
  const clairic = clairicConfig(usage, { accountId: "test", apiToken: "test", fetch });
  return { clairic, usage, sent };
}

describe("clairicConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Workers AI turns requests away under load; one refusal must not fail the case. */
  it("retries a request Workers AI answers with 429 until it is answered", async () => {
    // Arrange
    const { clairic, usage, sent } = endpoint(busy, busy, named);

    // Act
    const reading = people(clairic, "Alice paid Bob.");
    await vi.runAllTimersAsync();

    // Assert
    expect(await reading).toEqual([new Person("Alice")]);
    expect(sent.count).toBe(3);
    expect(usage).toEqual({ requests: 1, inputTokens: 100 });
  });

  it("rejects the reading once five attempts are refused", async () => {
    // Arrange
    const { clairic, sent } = endpoint(busy);

    // Act
    const reading = people(clairic, "Alice paid Bob.");
    const settled = expect(reading).rejects.toThrow(/429/u);
    await vi.runAllTimersAsync();

    // Assert
    await settled;
    expect(sent.count).toBe(5);
  });
});
