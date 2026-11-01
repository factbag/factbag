/**
 * Errors Factbag raises when the caller's program or declarations are invalid. Every class
 * here extends `ProgrammerError`.
 *
 * @packageDocumentation
 */
export {
  ExclusiveDefinitionProgrammerError,
  PrimitiveArithmeticProgrammerError,
  ProgrammerError,
  UnconstructiveRecursionProgrammerError,
  UnsafeUnboundVariableProgrammerError,
  UnsupportedPredicateError,
} from "./programmer-errors";
