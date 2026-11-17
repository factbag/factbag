import { describe, expect, it } from "vitest";
import type { Judgment, KnowledgeBaseDocument, Program, Rule } from "./generated/types";
import {
  validateCondition,
  validateJudgment,
  validateKnowledgeBaseDocument,
  validateLiteral,
  validateProgram,
  validateValue,
} from "./generated/validators.js";

const person = { kind: "entity", type: "Person", id: "alice" } as const;
const amount = { kind: "var", name: "Amount" } as const;
const income = {
  kind: "atom",
  predicate: "income",
  fields: { person, amount },
} as const;
const reviewed = { kind: "atom", predicate: "reviewed", fields: { person } } as const;
const rule: Rule = {
  kind: "iff",
  head: { kind: "atom", predicate: "eligible", fields: { person } },
  body: {
    kind: "letIn",
    variable: { kind: "var", name: "Total" },
    value: { kind: "sum", value: amount, where: income, completeWhen: reviewed },
    condition: { kind: "gte", left: { kind: "var", name: "Total" }, right: 100 },
  },
};
const program: Program = {
  predicates: [
    {
      name: "income",
      world: "open",
      params: { person: { kind: "entityType", type: "Person" }, amount: "number" },
    },
    {
      name: "reviewed",
      world: "closed",
      params: { person: { kind: "entityType", type: "Person" } },
    },
    { name: "eligible", world: "open", params: { person: { kind: "entityType", type: "Person" } } },
  ],
  literals: [
    {
      sign: "asserted",
      atom: { ...income, fields: { person, amount: 150 } },
      metadata: { source: "tax-return", annotations: { pages: [1, null] } },
    },
  ],
  rules: [rule],
};

describe("generated contract validators", () => {
  it("accepts a JSON document containing a nested aggregate rule and evidence", () => {
    // Arrange
    const document: KnowledgeBaseDocument = {
      kind: "KnowledgeBase",
      apiVersion: "factbag/v1alpha1",
      entities: [person],
      ...program,
    };
    const input: unknown = JSON.parse(JSON.stringify(document));
    // Act
    const accepted = validateKnowledgeBaseDocument(input);
    // Assert
    expect(accepted).toBe(true);
    expect(validateProgram(program)).toBe(true);
  });

  it.each([
    { name: "missing rules", value: { predicates: [], literals: [] } },
    {
      name: "a blank predicate name",
      value: { ...program, predicates: [{ name: " ", world: "open", params: {} }] },
    },
    {
      name: "a nested comparison without its right operand",
      value: {
        ...program,
        rules: [{ ...rule, body: { kind: "and", conditions: [{ kind: "gte", left: 1 }] } }],
      },
    },
    {
      name: "an invalid aggregate completeness condition",
      value: {
        ...program,
        rules: [
          {
            ...rule,
            body: {
              kind: "eq",
              left: { kind: "sum", value: amount, where: income, completeWhen: {} },
              right: 1,
            },
          },
        ],
      },
    },
  ])("rejects $name in a program", ({ value }) => {
    // Arrange: the case supplies a malformed program.
    // Act
    const accepted = validateProgram(value);
    // Assert
    expect(accepted).toBe(false);
  });

  it("keeps variables in rules out of accepted evidence", () => {
    // Arrange
    const evidence = { sign: "asserted", atom: income };
    // Act
    const conditionAccepted = validateCondition(income);
    const evidenceAccepted = validateLiteral(evidence);
    // Assert
    expect(conditionAccepted).toBe(true);
    expect(evidenceAccepted).toBe(false);
  });

  it("reports the JSON Pointer of a missing named operand", () => {
    // Arrange
    const condition = { kind: "gte", left: 1 };
    // Act
    const accepted = validateCondition(condition);
    // Assert
    expect(accepted).toBe(false);
    expect(validateCondition.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ instanceLocation: "#/right" })]),
    );
  });

  it("accepts proof results with tuple bindings and nested rule support", () => {
    // Arrange
    const judgment: Judgment = {
      goal: { kind: "goal", op: "atom", atom: rule.head },
      value: "true",
      bindings: [[amount, 150]],
      positive: [
        {
          source: "rule",
          rule,
          body: {
            goal: { kind: "goal", op: "atom", atom: reviewed },
            value: "true",
            bindings: [],
            positive: [{ source: "evidence", literals: [] }],
          },
        },
      ],
    };
    // Act
    const accepted = validateJudgment(judgment);
    const malformedBindingAccepted = validateJudgment({ ...judgment, bindings: [[amount]] });
    // Assert
    expect(accepted).toBe(true);
    expect(malformedBindingAccepted).toBe(false);
  });

  it.each([
    { value: { kind: "number", value: "Infinity" }, accepted: true },
    { value: { kind: "date", value: "2026-11-15T00:00:00.000Z" }, accepted: true },
    { value: { kind: "date", value: "yesterday" }, accepted: false },
    { value: { kind: "number", value: "NaN" }, accepted: false },
    { value: null, accepted: false },
  ])("validates tagged values: $value", ({ value, accepted }) => {
    // Arrange: the case supplies a JSON value and its expected validity.
    // Act
    const actual = validateValue(value);
    // Assert
    expect(actual).toBe(accepted);
  });
});
