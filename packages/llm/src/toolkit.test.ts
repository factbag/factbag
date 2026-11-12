import { describe, expect, it } from "vitest";
import { enumeration, predicate, query, variable } from "factbag/dsl";
import { KnowledgeBase, guard } from "factbag/kb";
import { CorrectableToolError, toolkit } from "./index";
import type { Toolkit, ToolResult } from "./index";

class Person {
  constructor(readonly id: string) {}
}

const employed = predicate(
  "employed",
  { person: Person, since: Date },
  {
    description: "The person works for the company.",
    parameters: { since: "When the employment began" },
  },
);
const scored = predicate("scored", {
  name: String,
  points: Number,
  verified: Boolean,
  grade: enumeration("pass", "fail"),
  level: enumeration(1, 2, 3),
  quarter: enumeration(new Date("2026-01-01T00:00:00.000Z"), new Date("2026-04-01T00:00:00.000Z")),
});

/** A call of the one tool, running `operation` on `name` with `args`. */
function run(kit: Toolkit, operation: string, name: string, args: unknown): ToolResult {
  return kit.call("knowledge_base", { operation, name, arguments: JSON.stringify(args) });
}

/** The tool's description: its operations and the notes on their arguments. */
function described(kit: Toolkit): string {
  return kit.tools()[0]?.description ?? "";
}

function people(...ids: string[]): KnowledgeBase {
  const kb = new KnowledgeBase();
  kb.entities.add(...ids.map((id) => new Person(id)));
  return kb;
}

describe("Toolkit.tools", () => {
  /**
   * A definition per operation repeats each argument's note, and what a predicate is about
   * for each of its operations; one tool must say each once.
   */
  it("offers one tool that says each name, with its operations, and each note once", () => {
    // Arrange
    const kit = toolkit(guard(people("ada")).permit("*", employed).block("deny", employed));

    // Act
    const tools = kit.tools();

    // Assert
    expect(tools.map((tool) => tool.name)).toEqual(["knowledge_base"]);
    expect(tools[0]?.description).toContain(
      "Names:\n" +
        "employed [assert, query](person[1], since[2], justification[3]): The person works for the company.\n\n" +
        "Notes:\n" +
        '[1] string, one of ["ada"]. Person id\n' +
        "[2] string. When the employment began. ISO 8601 date-time\n" +
        "[3] string. For assert and deny only, which require it. Why the source supports " +
        "this, citing it where possible",
    );
    expect(tools[0]?.inputSchema).toEqual({
      type: "object",
      additionalProperties: false,
      required: ["operation", "name", "arguments"],
      properties: {
        operation: { type: "string", enum: ["assert", "query"] },
        name: { type: "string", enum: ["employed"] },
        arguments: {
          type: "string",
          description: 'The operation\'s arguments as a JSON object, such as {"id":"Alice"}',
        },
      },
    });
  });

  it("describes every field type as a JSON primitive", () => {
    // Arrange
    const kit = toolkit(guard(new KnowledgeBase()).permit("query", scored));

    // Act
    const description = described(kit);

    // Assert
    expect(description).toContain(
      "scored [query](name[1], points[2], verified[3], grade[4], level[5], quarter[6])\n\n" +
        "Notes:\n" +
        "[1] string\n" +
        "[2] number\n" +
        "[3] boolean\n" +
        '[4] string, one of ["pass","fail"]\n' +
        "[5] number, one of [1,2,3]\n" +
        '[6] string, one of ["2026-01-01T00:00:00.000Z","2026-04-01T00:00:00.000Z"]',
    );
  });

  /** Entity IDs are listed for the model to pick from, so a stale list rejects new entities. */
  it("lists entities added after the toolkit was created", () => {
    // Arrange
    const kb = people("ada");
    const kit = toolkit(guard(kb).permit("query", employed));
    kit.tools();

    // Act
    kb.entities.add(new Person("grace"));

    // Assert
    expect(described(kit)).toContain('[1] string, one of ["ada","grace"]. Person id');
  });

  it("omits justification when it is not required", () => {
    // Arrange
    const kit = toolkit(guard(people("ada")).permit("assert", employed), {
      requireJustification: false,
    });

    // Act
    const description = described(kit);

    // Assert
    expect(description).toContain("employed [assert](person[1], since[2]):");
    expect(description).not.toContain("justification");
  });
});

describe("Toolkit entity tools", () => {
  class LegalEntity {
    constructor(readonly id: string) {}
  }
  const create = (id: string) => new Person(id);

  it("offers an add operation for each entity class the options name", () => {
    // Arrange
    const kit = toolkit(guard(new KnowledgeBase()), {
      entities: [
        [Person, create],
        [LegalEntity, (id) => new LegalEntity(id)],
      ],
    });

    // Act
    const description = described(kit);

    // Assert
    expect(description).toContain(
      "person [add](id[1]): Register a Person before any other operation refers to it.\n" +
        "legal_entity [add](id[2]): Register a LegalEntity before any other operation refers to it.",
    );
  });

  /** The point of the tool: a model can write facts about someone it found in the text. */
  it("registers an entity that later tool calls can refer to", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const kit = toolkit(guard(kb).permit("assert", employed), {
      requireJustification: false,
      entities: [[Person, create]],
    });

    // Act
    const added = run(kit, "add", "person", { id: "ada" });
    run(kit, "assert", "employed", { person: "ada", since: "2024-03-01T00:00:00.000Z" });

    // Assert
    const ada = kb.entities.get(Person, "ada");
    expect(added).toEqual({
      text: "Registered Person ada",
      outcome: { operation: "add", entity: ada },
    });
    expect(ada).toBeInstanceOf(Person);
    expect(described(kit)).toContain('string, one of ["ada"]. Person id');
    expect(kb.literals()).toHaveLength(1);
  });

  /** Facts hold entities by identity, so a repeated registration must not replace one. */
  it("keeps the entity already registered under an id", () => {
    // Arrange
    const ada = new Person("ada");
    const kb = new KnowledgeBase();
    kb.entities.add(ada);
    const kit = toolkit(guard(kb), { entities: [[Person, create]] });

    // Act
    const { outcome } = run(kit, "add", "person", { id: "ada" });

    // Assert
    expect(outcome).toEqual({ operation: "add", entity: ada });
    expect(kb.entities.get(Person, "ada")).toBe(ada);
  });

  it("rejects an empty id as correctable without registering", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const kit = toolkit(guard(kb), { entities: [[Person, create]] });

    // Act
    const call = () => run(kit, "add", "person", { id: " " });

    // Assert
    expect(call).toThrow(new CorrectableToolError("Expected id to be a non-empty string"));
    expect(kb.entities.ids(Person)).toEqual([]);
  });

  it("offers no add tool unless the options name the class", () => {
    // Arrange
    const kit = toolkit(guard(people("ada")).permit("query", employed));

    // Act
    const call = () => run(kit, "add", "person", { id: "grace" });

    // Assert
    expect(call).toThrow(new CorrectableToolError("Unknown operation: add person"));
  });

  it("throws when two entity classes would share a tool name", () => {
    // Arrange
    const entities = [
      [Person, create],
      [Person, create],
    ] as const;

    // Act
    const construct = () => toolkit(guard(new KnowledgeBase()), { entities });

    // Assert
    expect(construct).toThrow("Two entity classes share the name person");
  });
});

describe("Toolkit.call", () => {
  it("asserts evidence with its justification and source", () => {
    // Arrange
    const ada = new Person("ada");
    const kb = new KnowledgeBase();
    kb.entities.add(ada);
    const kit = toolkit(guard(kb).permit("assert", employed), { source: "intake-chat" });

    // Act
    const result = run(kit, "assert", "employed", {
      person: "ada",
      since: "2024-03-01T00:00:00.000Z",
      justification: "Her contract starts in March 2024",
    });

    // Assert
    const atom = employed({ person: ada, since: new Date("2024-03-01") });
    expect(result).toEqual({
      text: "Asserted employed(person=ada, since=2024-03-01T00:00:00.000Z)",
      outcome: { operation: "assert", atom },
    });
    const [literal] = kb.literals();
    expect(literal?.metadata).toEqual({
      source: "intake-chat",
      justification: "Her contract starts in March 2024",
    });
    expect(query(kb, atom).value).toBe("true");
  });

  it("answers queries with the judgment's value", () => {
    // Arrange
    const ada = new Person("ada");
    const kb = new KnowledgeBase();
    kb.entities.add(ada);
    const kit = toolkit(guard(kb).permit("*", employed), { requireJustification: false });
    const args = { person: "ada", since: "2024-03-01T00:00:00.000Z" };
    run(kit, "deny", "employed", args);

    // Act
    const { text, outcome } = run(kit, "query", "employed", args);

    // Assert
    const atom = employed({ person: ada, since: new Date(args.since) });
    const judgment = query(kb, atom);
    expect(judgment.value).toBe("false");
    expect(text).toBe('{"value":"false"}');
    expect(outcome).toEqual({ operation: "query", atom, judgment });
  });

  it("explains a query's value when asked to explain", () => {
    // Arrange
    const ada = new Person("ada");
    const kb = new KnowledgeBase();
    kb.entities.add(ada);
    const kit = toolkit(guard(kb).permit("*", employed), {
      requireJustification: false,
      explain: true,
    });
    const args = { person: "ada", since: "2024-03-01T00:00:00.000Z" };
    run(kit, "assert", "employed", args);

    // Act
    const { text } = run(kit, "query", "employed", args);

    // Assert
    expect(JSON.parse(text)).toEqual({
      value: "true",
      explanation: {
        claim: "employed(ada, 2024-03-01) = true",
        because: { claim: "employed(ada, 2024-03-01) = true" },
      },
    });
  });

  /** A deep proof in every reply fills the conversation; the model needs the reason, not all of it. */
  it("explains no more claims than the budget it is given", () => {
    // Arrange
    const ada = new Person("ada");
    const kb = new KnowledgeBase();
    kb.entities.add(ada);
    const since = variable("S");
    const who = variable("P");
    const tenured = predicate("tenured", { person: Person });
    kb.rule(tenured({ person: who })).iff(employed({ person: who, since }));
    kb.asserts(employed({ person: ada, since: new Date("2024-03-01T00:00:00.000Z") }));
    const kit = toolkit(guard(kb).permit("query", tenured), { explain: { budget: 1 } });

    // Act
    const { text } = run(kit, "query", "tenured", { person: "ada" });

    // Assert
    expect(JSON.parse(text)).toEqual({
      value: "true",
      explanation: {
        claim: "tenured(ada) = true",
        because: "tenured(P) iff employed(P, S)",
        given: [],
        notShown: ["employed(ada, 2024-03-01) = true"],
      },
    });
  });

  it("passes enumeration members to the predicate, including dates", () => {
    // Arrange
    const kb = new KnowledgeBase();
    const kit = toolkit(guard(kb).permit("assert", scored), { requireJustification: false });

    // Act
    run(kit, "assert", "scored", {
      name: "Ada",
      points: 9,
      verified: true,
      grade: "pass",
      level: 2,
      quarter: "2026-04-01T00:00:00.000Z",
    });

    // Assert
    const atom = scored({
      name: "Ada",
      points: 9,
      verified: true,
      grade: "pass",
      level: 2,
      quarter: new Date("2026-04-01T00:00:00.000Z"),
    });
    expect(query(kb, atom).value).toBe("true");
  });

  const valid = { person: "ada", since: "2024-03-01T00:00:00.000Z", justification: "Stated" };
  it.each([
    {
      case: "an unknown name",
      name: "unknown",
      args: valid,
      error: "Unknown operation: assert unknown",
    },
    {
      case: "a blocked operation",
      operation: "deny",
      args: valid,
      error: "Unknown operation: deny employed",
    },
    {
      case: "non-object arguments",
      args: [],
      error: "Expected the arguments to be a JSON object",
    },
    {
      case: "an extra argument",
      args: { ...valid, salary: 1 },
      error: "Unexpected argument: salary",
    },
    {
      case: "a missing argument",
      args: { person: "ada", since: valid.since },
      error: "Missing argument: justification",
    },
    {
      case: "an unknown entity",
      args: { ...valid, person: "bob" },
      error: "Unknown Person id for person: bob",
    },
    {
      case: "an invalid date",
      args: { ...valid, since: "soon" },
      error: "Expected since to be an ISO 8601 date-time",
    },
    {
      case: "a non-string justification",
      args: { ...valid, justification: 1 },
      error: "Expected justification to be a string",
    },
  ])("rejects $case as correctable without writing", (row) => {
    const { operation = "assert", name = "employed", args, error } = { ...row };
    // Arrange
    const kb = people("ada");
    const kit = toolkit(guard(kb).permit("assert", employed));

    // Act
    const call = () => run(kit, operation, name, args);

    // Assert
    expect(call).toThrow(new CorrectableToolError(error));
    expect(kb.literals()).toEqual([]);
  });

  it.each([
    {
      case: "a string enum",
      args: { grade: "great" },
      error: "Expected grade to be one of: pass, fail",
    },
    { case: "a number enum", args: { level: 4 }, error: "Expected level to be one of: 1, 2, 3" },
    { case: "a number", args: { points: "9" }, error: "Expected points to be a number" },
    { case: "a boolean", args: { verified: "yes" }, error: "Expected verified to be a boolean" },
  ])("rejects a value outside $case", ({ args, error }) => {
    // Arrange
    const kit = toolkit(guard(new KnowledgeBase()).permit("query", scored));
    const base = {
      name: "Ada",
      points: 9,
      verified: true,
      grade: "pass",
      level: 2,
      quarter: "2026-01-01T00:00:00.000Z",
    };

    // Act
    const call = () => run(kit, "query", "scored", { ...base, ...args });

    // Assert
    expect(call).toThrow(new CorrectableToolError(error));
  });
});

describe("Toolkit.call of the tool itself", () => {
  /** A model can get the envelope wrong as well as an operation's arguments. */
  it.each([
    {
      case: "a tool that is not the knowledge base",
      name: "assert_employed",
      args: { person: "ada" },
      error: "Unknown tool: assert_employed",
    },
    {
      case: "no operation",
      name: "knowledge_base",
      args: { arguments: "{}" },
      error: "Expected operation to be assert, deny, query or add",
    },
    {
      case: "no name",
      name: "knowledge_base",
      args: { operation: "assert", arguments: "{}" },
      error: "Expected name to be what the operation acts on",
    },
    {
      case: "arguments given as an object",
      name: "knowledge_base",
      args: { operation: "assert", name: "employed", arguments: { person: "ada" } },
      error: "Expected arguments to be a JSON object written as a string",
    },
    {
      case: "arguments that are not JSON",
      name: "knowledge_base",
      args: { operation: "assert", name: "employed", arguments: "{person" },
      error: "The arguments are not valid JSON",
    },
  ])("tells the model what to fix for $case", ({ name, args, error }) => {
    // Arrange
    const kit = toolkit(guard(people("ada")).permit("assert", employed));

    // Act
    const call = (): unknown => kit.call(name, args);

    // Assert
    expect(call).toThrow(new CorrectableToolError(error));
  });
});
