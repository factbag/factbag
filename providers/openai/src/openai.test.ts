import { describe, expect, it } from "vitest";
import { predicate } from "factbag/dsl";
import { KnowledgeBase, guard } from "factbag/kb";
import { toolkit } from "./index";

const employed = predicate(
  "employed",
  { person: String },
  { description: "The person has a job." },
);

function kit(kb = new KnowledgeBase()) {
  return toolkit(guard(kb).permit("assert", employed), { requireJustification: false });
}

/** A call of the one tool, running `operation` on `employed` with `args` as the model would write them. */
function call(operation: string, args: string) {
  const envelope = { operation, name: "employed", arguments: args };
  return {
    id: "call_1",
    type: "function",
    function: { name: "knowledge_base", arguments: JSON.stringify(envelope) },
  } as const;
}

describe("Toolkit.tools", () => {
  it("describes the knowledge base as one strict Chat Completions function", () => {
    // Arrange
    const tools = kit();

    // Act
    const result = tools.tools();

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "function",
      function: {
        name: "knowledge_base",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["operation", "name", "arguments"],
          properties: {
            operation: { type: "string", enum: ["assert"] },
            name: { type: "string", enum: ["employed"] },
          },
        },
        strict: true,
      },
    });
    expect(result[0]?.function.description).toContain(
      "employed [assert](person[1]): The person has a job.",
    );
  });
});

describe("Toolkit.answer", () => {
  it("runs the call and answers with its tool message and what it did", () => {
    // Arrange
    const kb = new KnowledgeBase();

    // Act
    const answer = kit(kb).answer(call("assert", '{"person":"Ada"}'));

    // Assert
    expect(answer).toEqual({
      message: { role: "tool", tool_call_id: "call_1", content: "Asserted employed(person=Ada)" },
      outcome: { operation: "assert", atom: employed({ person: "Ada" }) },
    });
    expect(kb.literals()).toHaveLength(1);
  });

  it("answers a call the model can correct with the error, writing nothing", () => {
    // Arrange
    const kb = new KnowledgeBase();

    // Act
    const answer = kit(kb).answer(call("assert", "{"));

    // Assert
    expect(answer).toEqual({
      message: {
        role: "tool",
        tool_call_id: "call_1",
        content: "Error: The arguments are not valid JSON",
      },
      outcome: undefined,
    });
    expect(kb.literals()).toEqual([]);
  });

  /** Only the model's mistakes become messages; a broken KB must still reach the caller. */
  it("throws errors the model cannot correct", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const tools = toolkit(
      guard(kb).permit("assert", employed, predicate("employed", { id: String })),
    );

    // Act
    const answer = () => tools.answer(call("assert", '{"person":"Ada"}'));

    // Assert
    expect(answer).toThrow("Two permitted predicates are named employed");
  });
});
