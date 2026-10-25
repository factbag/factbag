import { emptySumTestCases } from "./empty-number-sum.test-case";
import { equalityTestCases } from "./equality.test-case";
import { judgmentContextTestCases } from "./judgment-context.test-case";
import { roundingTestCases } from "./rounding.test-case";
import { deadPathLetTestCases } from "./dead-path-let.test-case";
import { deadPathComparisonTestCases } from "./dead-path-comparison.test-case";
import { regressionExamples as regressionFalseCandidates } from "./false-candidates.test-case";
import { orAfterFailedPathTestCases } from "./or-after-failed-path.test-case";
import { orArithmeticTestCases } from "./or-arithmetic.test-case";
import { orBindingValidationTestCases } from "./or-binding-validation.test-case";
import { orEnvironmentTestCases } from "./or-environments.test-case";
import { boundValuesTestCases } from "./bound-values.test-case";
import { aggregateCompletenessTestCases } from "./aggregate-completeness.test-case";
import { aggregateCountIntervalTestCases } from "./aggregate-count-interval.test-case";
import { closedWorldNegationTestCase } from "./closed-world-negation.test-case";
import {
  closedWorldPositiveArithmeticBoundaryTestCase,
  closedWorldPositiveBoundaryTestCase,
} from "./closed-world-positive-boundary.test-case";
import { dateWindowRulesTestCases } from "./date-window-rules.test-case";
import { derivedPredicateBoundaryTestCase } from "./derived-predicate-boundary.test-case";
import { evidenceNegationTestCases } from "./evidence-negation.test-case";
import { evidenceMetadataProofTestCase } from "./evidence-metadata-proof.test-case";
import { exclusiveDefinitionTestCase } from "./exclusive-definition.test-case";
import { existsMissingRelationTestCases, existsWitnessTestCase } from "./exists-witness.test-case";
import { goalValueTruthTableTestCases } from "./goal-value-truth-table.test-case";
import { headConflictTestCase } from "./head-conflict.test-case";
import { letBindingPlaceholderTestCase } from "./let-binding-placeholder.test-case";
import { missingBindingProofTestCases } from "./missing-binding-proof.test-case";
import { multipleRuleDisjunctionTestCase } from "./multiple-rule-disjunction.test-case";
import { orBindingPropagationTestCase } from "./or-binding-propagation.test-case";
import {
  openWorldUnboundArithmeticTestCase,
  openWorldUnboundArithmeticOrTestCase,
  openWorldUnboundNestedArithmeticTestCase,
  openWorldUnboundPrimitiveOrTestCase,
  openWorldUnboundPrimitiveTestCase,
} from "./open-world-unbound-primitive.test-case";
import { primitiveFailureTestCase } from "./primitive-failure.test-case";
import { queryVsQueryAllTestCases } from "./query-vs-query-all.test-case";
import {
  mutualRecursionCycleTestCase,
  pureMutualRecursionCycleTestCase,
} from "./mutual-recursion-cycle.test-case";
import { recursiveRulesTestCase } from "./recursive-rules.test-case";
import { retractionTestCases } from "./retraction.test-case";
import { smokeGoalValueTestCases } from "./smoke-goal-values.test-case";
import { unknownConjunctionSubgoalsTestCase } from "./unknown-conjunction-subgoals.test-case";
import { unsupportedBodyPlaceholderTestCase } from "./unsupported-body-placeholder.test-case";
import { unsafeUnboundVariableTestCases } from "./unsafe-unbound-variable.test-case";
import {
  constructiveRecursionBoundaryTestCases,
  unconstructiveRecursionTestCases,
} from "./unconstructive-recursion.test-case";
import type { DslTestSpec } from "../test-runner/test-runner";

export const testCases: readonly DslTestSpec[] = [
  ...equalityTestCases,
  ...judgmentContextTestCases,
  ...roundingTestCases,
  ...emptySumTestCases,
  ...deadPathLetTestCases,
  ...deadPathComparisonTestCases,
  ...regressionFalseCandidates,
  ...orAfterFailedPathTestCases,
  ...orArithmeticTestCases,
  ...orBindingValidationTestCases,
  ...orEnvironmentTestCases,
  ...boundValuesTestCases,
  ...smokeGoalValueTestCases,
  ...goalValueTruthTableTestCases,
  derivedPredicateBoundaryTestCase,
  ...evidenceNegationTestCases,
  closedWorldNegationTestCase,
  unknownConjunctionSubgoalsTestCase,
  closedWorldPositiveBoundaryTestCase,
  closedWorldPositiveArithmeticBoundaryTestCase,
  ...dateWindowRulesTestCases,
  ...aggregateCompletenessTestCases,
  ...aggregateCountIntervalTestCases,
  recursiveRulesTestCase,
  multipleRuleDisjunctionTestCase,
  mutualRecursionCycleTestCase,
  pureMutualRecursionCycleTestCase,
  ...constructiveRecursionBoundaryTestCases,
  ...unconstructiveRecursionTestCases,
  ...queryVsQueryAllTestCases,
  ...retractionTestCases,
  orBindingPropagationTestCase,
  existsWitnessTestCase,
  ...existsMissingRelationTestCases,
  unsupportedBodyPlaceholderTestCase,
  letBindingPlaceholderTestCase,
  ...unsafeUnboundVariableTestCases,
  openWorldUnboundPrimitiveTestCase,
  openWorldUnboundArithmeticTestCase,
  openWorldUnboundNestedArithmeticTestCase,
  openWorldUnboundPrimitiveOrTestCase,
  openWorldUnboundArithmeticOrTestCase,
  ...missingBindingProofTestCases,
  primitiveFailureTestCase,
  evidenceMetadataProofTestCase,
  headConflictTestCase,
  exclusiveDefinitionTestCase,
];
