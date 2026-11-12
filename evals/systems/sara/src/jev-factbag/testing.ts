import type { SymbolExtractorConfig } from "@factbag/symbol-extractor-clairic";
import { clairicConfig } from "./symbols";
import type { ClairicUsage } from "./symbols";

/** One Clairic field as the extractor asks for it. */
export type ClairicField = Readonly<{
  relation: string;
  field: string;
  items: "text" | "number" | "date";
}>;

type Spec = Readonly<{ items: ClairicField["items"]; instructions: string }>;

/**
 * The eval's Clairic config against a fake Workers AI endpoint that answers each field with
 * the list `answer` gives for it, so a test controls what Clairic "reads". Every response
 * reports 100 input tokens, added to `usage`.
 */
export function fakeClairic(
  answer: (field: ClairicField) => readonly unknown[],
  usage: ClairicUsage = { requests: 0, inputTokens: 0 },
): SymbolExtractorConfig {
  const fetch: typeof globalThis.fetch = async (_, init) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The extractor sends JSON.
    const { fields } = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      fields: Record<string, Spec>;
    };
    const answers = Object.fromEntries(
      Object.entries(fields).map(([key, { items, instructions }]) => {
        const [, field = "", relation = ""] =
          /fill "([^"]+)" in the relation "([^"]+)"/u.exec(instructions) ?? [];
        return [key, { value: answer({ relation, field, items }) }];
      }),
    );
    const result = { answers, usage: { input_tokens: 100, output_tokens: 0 } };
    return await Promise.resolve(Response.json({ success: true, result }));
  };
  return clairicConfig(usage, { accountId: "test", apiToken: "test", fetch });
}
