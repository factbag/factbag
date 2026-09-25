import type { AggregateBuilder, Formula, NumericTerm, Term } from "../types";

/**
 * Sum a numeric term over the rows matched by the aggregate body. Complete
 * the aggregate with `.where(body)` or `.where(body, { completeWhen })`.
 *
 * @remarks
 * `completeWhen` attaches a completeness condition to the aggregate: while
 * the condition is unmet, a below-threshold total stays unknown instead of
 * collapsing to false, since more rows may still arrive.
 *
 * @example
 * ```ts
 * kb.rule(annualIncomeOver200k({ person: P, year: Y })).iff(
 *   letIn(
 *     Total,
 *     sum(Amount).where(incomeFact({ person: P, year: Y, amountCents: Amount }), {
 *       completeWhen: incomeReviewComplete({ person: P, year: Y }),
 *     }),
 *     gt(Total, 20_000_000),
 *   ),
 * );
 * ```
 */
export function sum(value: NumericTerm): AggregateBuilder<number | bigint> {
  return aggregateBuilder("sum", value);
}

/**
 * Count the rows matched by the aggregate body. Runs through the same
 * aggregate machinery as {@link sum}, but thresholds the number of matching
 * rows rather than a value total.
 */
export function count(value: Term): AggregateBuilder {
  return aggregateBuilder("count", value);
}

/**
 * Build an aggregate descriptor whose `where` records the summed value, the
 * aggregate body, and any completeness condition. Both arguments are preserved so
 * that `completeWhen` stays attached to the aggregate rather than the rule.
 */
function aggregateBuilder<Value extends number | bigint>(
  kind: string,
  value: NumericTerm | Term,
): AggregateBuilder<Value> {
  const where = (
    body: unknown,
    options?: Readonly<{ completeWhen: unknown }>,
  ): Formula<Value, readonly unknown[]> => ({
    kind,
    args: options === undefined ? [value, body] : [value, body, options],
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The implementation represents both generic where overloads at runtime.
  return { where } as unknown as AggregateBuilder<Value>;
}
