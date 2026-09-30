import type { JSX } from "react";

import type { GoalValue } from "@factbag/core/query";

import { VERDICT } from "../theme";

/** The verdict as a colored pill: symbol plus label. */
export function ValuePill(props: { readonly value: GoalValue }): JSX.Element {
  const meta = VERDICT[props.value];

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-2 text-xs leading-none font-extrabold text-white ${meta.pill}`}
      title={meta.label}
    >
      {meta.symbol} {meta.label}
    </span>
  );
}
