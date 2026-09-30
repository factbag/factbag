"use client";

import { useState, type JSX } from "react";

import { DiagramCanvas, FlowEdge, treeCurve } from "./lib/diagram";
import { solveScaffold } from "./lib/live";
import { ValueDots, VerdictCard, WidgetShell } from "./lib/ui";
import { cycleValue, RANK, VALUES, type GoalValue, type Operator } from "./lib/values";
import { VERDICT } from "./theme";

/** Plainer glyphs than the lattice's ⊤/⊥ for the premises in this widget. */
const SYMBOL: Record<GoalValue, string> = {
  conflicted: "!",
  false: "✗",
  true: "✓",
  unknown: "?",
};

const LEAF_NAMES: readonly string[] = ["A", "B", "C", "D"];
const LEAF_XS: readonly number[] = [80, 240, 400, 560];
const LEAF_Y = 66;
const HUB_X = 320;
const HUB_Y = 212;
const RESULT_Y = 296;
const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 344;
const RAIL_LINE_Y = 112;
const RAIL_TOTAL_HEIGHT = 184;

export function EvaluationGraph(): JSX.Element {
  const [operator, setOperator] = useState<Operator>("and");
  const [leaves, setLeaves] = useState<readonly GoalValue[]>([
    "true",
    "unknown",
    "true",
    "conflicted",
  ]);

  const result = solveScaffold([{ id: "H", inputs: ["A", "B", "C", "D"], operator }], {
    A: leaves[0] ?? "unknown",
    B: leaves[1] ?? "unknown",
    C: leaves[2] ?? "unknown",
    D: leaves[3] ?? "unknown",
  }).H;
  const resultMeta = VERDICT[result];
  const targetRank = RANK[result];

  function cycleLeaf(index: number, direction: 1 | -1): void {
    setLeaves((current) =>
      current.map((value, position) => (position === index ? cycleValue(value, direction) : value)),
    );
  }

  return (
    <WidgetShell>
      <DiagramCanvas
        height={GRAPH_HEIGHT}
        svg={
          <>
            {leaves.map((value, index) => (
              <FlowEdge
                key={LEAF_NAMES[index]}
                active={RANK[value] === targetRank}
                d={treeCurve(LEAF_XS[index] ?? 0, LEAF_Y, HUB_X, HUB_Y)}
                color={VERDICT[value].color}
              />
            ))}
            <FlowEdge
              active
              d={`M ${HUB_X} ${HUB_Y} L ${HUB_X} ${RESULT_Y}`}
              color={resultMeta.color}
            />
          </>
        }
        width={GRAPH_WIDTH}
      >
        {leaves.map((value, index) => {
          const meta = VERDICT[value];
          const name = LEAF_NAMES[index] ?? "?";

          return (
            <button
              key={name}
              aria-label={`Premise ${name} is ${meta.label}. Activate to cycle its value.`}
              className={`absolute grid w-31 -translate-x-1/2 -translate-y-1/2 cursor-pointer justify-items-center gap-0.5 rounded-2xl border-2 bg-white/95 px-2 py-2.5 shadow-lg transition-colors hover:shadow-xl ${meta.border}`}
              style={{ left: LEAF_XS[index], top: LEAF_Y }}
              type="button"
              onClick={(event) => cycleLeaf(index, event.shiftKey ? -1 : 1)}
            >
              <span
                key={value}
                className={`value-pop font-serif text-4xl leading-none font-bold ${meta.text}`}
              >
                {SYMBOL[value]}
              </span>
              <span className="text-sm font-bold">{name}</span>
              <span className={`text-xs leading-none font-semibold ${meta.text}`}>
                {meta.label}
              </span>
              <ValueDots className="mt-1.5" value={value} />
            </button>
          );
        })}
        <button
          aria-label={`Operator is ${operator === "and" ? "AND" : "OR"}. Activate to switch.`}
          className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full border-4 bg-white shadow-lg transition-all hover:scale-110"
          style={{ borderColor: resultMeta.color, left: HUB_X, top: HUB_Y }}
          title="Switch between AND and OR"
          type="button"
          onClick={() => setOperator(operator === "and" ? "or" : "and")}
        >
          <span className="text-base leading-none font-extrabold tracking-wide">
            {operator === "and" ? "AND" : "OR"}
          </span>
        </button>
        <VerdictCard
          caption="derived goal"
          className="absolute -translate-x-1/2 -translate-y-1/2"
          Icon={resultMeta.Icon}
          style={{ left: HUB_X, top: RESULT_Y }}
          title={<span className="whitespace-nowrap">H = {resultMeta.label}</span>}
          value={result}
        />
      </DiagramCanvas>
      <p className="mt-1 text-center font-mono text-sm text-slate-700">
        H = {operator === "and" ? "AND" : "OR"}({leaves.map((value) => SYMBOL[value]).join(", ")}) ={" "}
        {SYMBOL[result]}
      </p>
      <RankRail leaves={leaves} result={result} />
    </WidgetShell>
  );
}

function RankRail(props: {
  readonly leaves: readonly GoalValue[];
  readonly result: GoalValue;
}): JSX.Element {
  const stacks: Record<GoalValue, number> = { conflicted: 0, false: 0, true: 0, unknown: 0 };
  const chips = props.leaves.map((value, index) => {
    const stack = stacks[value];
    stacks[value] += 1;

    return { name: LEAF_NAMES[index] ?? "?", stack, value };
  });

  return (
    <div className="mt-5 overflow-x-auto">
      <div className="relative mx-auto" style={{ height: RAIL_TOTAL_HEIGHT, width: GRAPH_WIDTH }}>
        <div
          className="absolute h-0.5 bg-slate-300"
          style={{
            left: LEAF_XS[0],
            top: RAIL_LINE_Y,
            width: (LEAF_XS[3] ?? 0) - (LEAF_XS[0] ?? 0),
          }}
        />
        <span
          className="absolute text-xs font-bold text-slate-400"
          style={{ left: 0, top: RAIL_LINE_Y - 7 }}
        >
          ◀ weaker
        </span>
        <span
          className="absolute text-xs font-bold text-slate-400"
          style={{ right: 0, top: RAIL_LINE_Y - 7 }}
        >
          stronger ▶
        </span>
        {VALUES.map((value, rank) => {
          const meta = VERDICT[value];
          const isResult = value === props.result;

          return (
            <div key={value}>
              <span
                className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${meta.pill}`}
                style={{ left: LEAF_XS[rank], top: RAIL_LINE_Y }}
              />
              <span
                className={`absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-3 transition-all duration-300 ${
                  isResult ? "opacity-100" : "scale-50 opacity-0"
                }`}
                style={{ borderColor: meta.color, left: LEAF_XS[rank], top: RAIL_LINE_Y }}
              />
              <span
                className={`absolute -translate-x-1/2 text-center text-xs font-bold ${meta.text}`}
                style={{ left: LEAF_XS[rank], top: RAIL_LINE_Y + 16 }}
              >
                {SYMBOL[value]} {meta.label}
                <span
                  className={`block text-2xs font-extrabold tracking-wide text-slate-500 uppercase transition-opacity duration-300 ${
                    isResult ? "opacity-100" : "opacity-0"
                  }`}
                >
                  ▲ H lands here
                </span>
              </span>
            </div>
          );
        })}
        {chips.map((chip) => (
          <span
            key={chip.name}
            className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-extrabold text-white shadow transition-all duration-300 ${VERDICT[chip.value].pill}`}
            style={{
              left: LEAF_XS[RANK[chip.value]],
              top: RAIL_LINE_Y - 18 - chip.stack * 26,
            }}
          >
            {chip.name}
          </span>
        ))}
      </div>
    </div>
  );
}
