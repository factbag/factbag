/**
 * The knowledge base: store signed evidence literals, declare derivation
 * rules, and register domain entities.
 *
 * @packageDocumentation
 */
export {
  ExclusiveDefinitionProgrammerError,
  ProgrammerError,
  PrimitiveArithmeticProgrammerError,
  UnsafeUnboundVariableProgrammerError,
} from "../exceptions/programmer-errors";
export type { EvidenceMetadata } from "../types/evidence-metadata";
export type { Annotations, AnnotationValue } from "../types/annotations";
export type {
  AnyLiteral,
  Literal,
  LiteralSign,
  NegativeLiteral,
  PositiveLiteral,
} from "../types/literal";
export type { AnyRule, Rule, RuleKind } from "../types/rule";
export type { LiteralFilter, RuleBuilder } from "../dsl/types";
export { EntityRegistry, KnowledgeBase } from "./knowledge-base";
