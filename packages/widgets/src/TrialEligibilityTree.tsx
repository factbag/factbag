"use client";

import { useState, type JSX } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  FileSignature,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { CodeBlock, type CodeLine } from "./lib/CodeBlock";
import { DiagramCanvas, FlowEdge, treeCurve } from "./lib/diagram";
import { solveScaffold } from "./lib/live";
import { Hint, OperatorBadge, RuleBox, ValueDots, ValueLadder, WidgetShell } from "./lib/ui";
import { cycleValue, formatNames, RANK, type GoalValue, type Operator } from "./lib/values";
import { VERDICT } from "./theme";

type LeafId = "inclusion" | "exclusion" | "consent" | "ecogStd" | "ecogExt";
type GateId = "route1" | "route2" | "perf" | "eligible";
type NodeId = LeafId | GateId;

type Leaf = {
  readonly code: string;
  readonly Icon: LucideIcon;
  readonly id: LeafId;
  readonly label: string;
  readonly x: number;
};

type Gate = {
  readonly code?: string;
  readonly id: GateId;
  readonly inputs: readonly NodeId[];
  readonly label: string;
  readonly operator: Operator;
  readonly x: number;
  readonly y: number;
};

const LEAF_Y = 78;
const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 556;
const JUNCTION_OFFSET = 58;

const LEAVES: readonly Leaf[] = [
  {
    code: "meets_inclusion_criteria",
    Icon: ClipboardCheck,
    id: "inclusion",
    label: "Inclusion criteria met",
    x: 84,
  },
  {
    code: "exclusion_review_cleared",
    Icon: ShieldCheck,
    id: "exclusion",
    label: "Exclusion review cleared",
    x: 226,
  },
  {
    code: "consent_date",
    Icon: FileSignature,
    id: "consent",
    label: "Consent date on file",
    x: 400,
  },
  {
    code: "ecog_score",
    Icon: Stethoscope,
    id: "ecogStd",
    label: "ECOG ≤ 1, standard window",
    x: 542,
  },
  {
    code: "ecog_score",
    Icon: CalendarDays,
    id: "ecogExt",
    label: "ECOG ≤ 1, extended window",
    x: 684,
  },
];

/** Ordered so every gate's inputs are evaluated before the gate itself. */
const GATES: readonly Gate[] = [
  {
    id: "route1",
    inputs: ["consent", "ecogStd"],
    label: "Route 1 · standard window",
    operator: "and",
    x: 470,
    y: 222,
  },
  {
    id: "route2",
    inputs: ["consent", "ecogExt"],
    label: "Route 2 · extended window",
    operator: "and",
    x: 646,
    y: 222,
  },
  {
    code: "adequate_performance_status",
    id: "perf",
    inputs: ["route1", "route2"],
    label: "Performance status adequate",
    operator: "or",
    x: 558,
    y: 352,
  },
  {
    code: "trial_eligible",
    id: "eligible",
    inputs: ["inclusion", "exclusion", "perf"],
    label: "Eligible for study RX-204",
    operator: "and",
    x: 290,
    y: 478,
  },
];

const EVIDENCE_ATOMS: Record<LeafId, string> = {
  consent: "consentDate({ patient: maya, trial: studyRx204, date: consentDay })",
  ecogExt: "ecogScore({ patient: maya, date: extendedWindowVisit, score: 1 })",
  ecogStd: "ecogScore({ patient: maya, date: inWindowVisit, score: 1 })",
  exclusion: "exclusionReviewCleared({ patient: maya, trial: studyRx204 })",
  inclusion: "meetsInclusionCriteria({ patient: maya, trial: studyRx204 })",
};

const RULE_LINES: readonly CodeLine[] = [
  { text: "", tone: "plain" },
  {
    text: "// two routes to the same head — their contributions combine by OR",
    tone: "comment",
  },
  { text: "kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(", tone: "plain" },
  { text: "  and(", tone: "plain" },
  { text: "    consentDate({ patient: P, trial: T, date: ConsentDate }),", tone: "plain" },
  { text: "    ecogScore({ patient: P, date: VisitDate, score: Score }),", tone: "plain" },
  {
    text: "    gte(VisitDate, sub(ConsentDate, 14 * dayMs)), // standard 14-day window",
    tone: "plain",
  },
  { text: "    lte(VisitDate, ConsentDate),", tone: "plain" },
  { text: "    lte(Score, 1),", tone: "plain" },
  { text: "  ),", tone: "plain" },
  { text: ");", tone: "plain" },
  { text: "kb.rule(adequatePerformanceStatus({ patient: P, trial: T })).if(", tone: "plain" },
  { text: "  and(", tone: "plain" },
  { text: "    consentDate({ patient: P, trial: T, date: ConsentDate }),", tone: "plain" },
  { text: "    ecogScore({ patient: P, date: VisitDate, score: Score }),", tone: "plain" },
  {
    text: "    gte(VisitDate, sub(ConsentDate, add(7 * dayMs, 7 * dayMs))), // extended window",
    tone: "plain",
  },
  { text: "    lte(VisitDate, ConsentDate),", tone: "plain" },
  { text: "    lte(Score, 1),", tone: "plain" },
  { text: "  ),", tone: "plain" },
  { text: ");", tone: "plain" },
  { text: "", tone: "plain" },
  { text: "// the top-level criterion rule — its body evaluates by AND", tone: "comment" },
  { text: "kb.rule(trialEligible({ patient: P, trial: T })).iff(", tone: "plain" },
  { text: "  and(", tone: "plain" },
  { text: "    meetsInclusionCriteria({ patient: P, trial: T }),", tone: "plain" },
  { text: "    exclusionReviewCleared({ patient: P, trial: T }),", tone: "plain" },
  { text: "    adequatePerformanceStatus({ patient: P, trial: T }),", tone: "plain" },
  { text: "  ),", tone: "plain" },
  { text: ");", tone: "plain" },
];

const VERDICTS: Record<GoalValue, string> = {
  false: "No — not eligible",
  unknown: "Need more evidence",
  conflicted: "Records disagree — needs review",
  true: "Yes — eligible",
};

type Position = { readonly x: number; readonly y: number };

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- LEAVES and GATES together enumerate every NodeId; Object.fromEntries erases that key union.
const POSITIONS = Object.fromEntries([
  ...LEAVES.map((leaf) => [leaf.id, { x: leaf.x, y: LEAF_Y }]),
  ...GATES.map((gate) => [gate.id, { x: gate.x, y: gate.y }]),
]) as Record<NodeId, Position>;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- LEAVES and GATES together enumerate every NodeId; Object.fromEntries erases that key union.
const NODE_LABELS = Object.fromEntries([
  ...LEAVES.map((leaf) => [leaf.id, leaf.label]),
  ...GATES.map((gate) => [gate.id, gate.label]),
]) as Record<NodeId, string>;

export function TrialEligibilityTree(): JSX.Element {
  const [leafValues, setLeafValues] = useState<Record<LeafId, GoalValue>>({
    consent: "true",
    ecogExt: "true",
    ecogStd: "false",
    exclusion: "true",
    inclusion: "true",
  });

  const values = evaluate(leafValues);

  function cycleLeaf(id: LeafId, direction: 1 | -1): void {
    setLeafValues((current) => ({ ...current, [id]: cycleValue(current[id], direction) }));
  }

  return (
    <WidgetShell
      eyebrow="A deeper rule — from @factbag/core examples"
      title="Is Maya eligible for study RX-204?"
    >
      <RuleBox>
        <strong>The rule:</strong> Maya is eligible if she meets the inclusion criteria,{" "}
        <strong>AND</strong> the exclusion review is cleared, <strong>AND</strong> her performance
        status is adequate. Performance status is adequate if <strong>EITHER</strong> screening
        route succeeds — and each route needs the consent date on file <strong>AND</strong> an ECOG
        score inside its window (the standard 14-day window, or the extended one).
      </RuleBox>
      <Hint>
        Tap the five evidence cards on top; everything below is derived. Note how the consent date
        feeds both routes.
      </Hint>
      <DiagramCanvas
        height={GRAPH_HEIGHT}
        svg={GATES.flatMap((gate) => {
          const junction = { x: gate.x, y: gate.y - JUNCTION_OFFSET };

          return [
            ...gate.inputs.map((input) => {
              const from = POSITIONS[input];

              return (
                <FlowEdge
                  key={`${input}-${gate.id}`}
                  active={RANK[values[input]] === RANK[values[gate.id]]}
                  d={treeCurve(from.x, from.y, junction.x, junction.y)}
                  color={VERDICT[values[input]].color}
                />
              );
            }),
            <FlowEdge
              key={`${gate.id}-trunk`}
              active
              d={`M ${junction.x} ${junction.y} L ${gate.x} ${gate.y}`}
              color={VERDICT[values[gate.id]].color}
            />,
          ];
        })}
        width={GRAPH_WIDTH}
      >
        {LEAVES.map((leaf) => {
          const value = leafValues[leaf.id];
          const meta = VERDICT[value];
          const words = VERDICT[value];
          const StatusIcon = words.Icon;

          return (
            <button
              key={leaf.id}
              aria-label={`${leaf.label}: ${words.word}. Activate to change the answer.`}
              className={`absolute grid w-32 -translate-x-1/2 -translate-y-1/2 cursor-pointer justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-2 py-2 shadow-lg transition-colors hover:shadow-xl ${meta.border}`}
              style={{ left: leaf.x, top: LEAF_Y }}
              type="button"
              onClick={(event) => cycleLeaf(leaf.id, event.shiftKey ? -1 : 1)}
            >
              <leaf.Icon className="size-5 text-slate-600" strokeWidth={2.5} />
              <span className="min-h-7 text-center text-xs leading-tight font-bold">
                {leaf.label}
              </span>
              <span className="max-w-full truncate font-mono text-2xs leading-none text-slate-400">
                {leaf.code}
              </span>
              <span
                key={value}
                className={`value-pop text-sm leading-none font-extrabold ${meta.text}`}
              >
                <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {words.word}
              </span>
              <ValueDots className="mt-0.5" value={value} />
            </button>
          );
        })}
        {GATES.map((gate) => {
          const value = values[gate.id];
          const meta = VERDICT[value];
          const words = VERDICT[value];
          const StatusIcon = words.Icon;
          const isVerdict = gate.id === "eligible";

          return (
            <div
              key={gate.id}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-3 py-2 text-center shadow-lg transition-colors ${
                isVerdict ? "w-52.5" : "w-40"
              }`}
              style={{ borderColor: meta.color, left: gate.x, top: gate.y }}
            >
              <span className="text-xs leading-tight font-bold">{gate.label}</span>
              {gate.code === undefined ? null : (
                <span className="max-w-full truncate font-mono text-2xs leading-none text-slate-400">
                  {gate.code}
                </span>
              )}
              <span
                key={value}
                className={`value-pop leading-none font-extrabold ${meta.text} ${
                  isVerdict ? "text-sm" : "text-sm"
                }`}
              >
                <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} />{" "}
                {isVerdict ? VERDICTS[value] : words.word}
              </span>
            </div>
          );
        })}
        {GATES.map((gate) => (
          <OperatorBadge
            key={`${gate.id}-badge`}
            operator={gate.operator}
            x={gate.x}
            y={gate.y - JUNCTION_OFFSET}
          />
        ))}
      </DiagramCanvas>
      <div className="mt-3 grid gap-1.5 rounded-2xl bg-slate-950/5 p-4">
        {[...GATES].reverse().map((gate) => {
          const meta = VERDICT[values[gate.id]];
          const words = VERDICT[values[gate.id]];
          const StatusIcon = words.Icon;

          return (
            <p key={gate.id} className="text-sm leading-5 text-slate-700">
              <span className={`font-extrabold ${meta.text}`}>
                <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {gate.label}
              </span>{" "}
              — {gateTrace(gate, values)}
            </p>
          );
        })}
      </div>
      <CodeBlock
        lines={[
          { text: "// evidence", tone: "comment" },
          ...evidenceLines(leafValues),
          ...RULE_LINES,
        ]}
        title="factbag DSL — the evidence block follows your taps"
      />
      <ValueLadder />
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Entities and predicates come from{" "}
        <code className="font-mono text-xs">
          packages/core/examples/scenarios/clinical-trial.ts
        </code>
        ; the two performance routes mirror the standard and extended screening windows in{" "}
        <code className="font-mono text-xs">date-window-rules.test-case.ts</code>, and multiple
        rules for the same head combining by OR is{" "}
        <code className="font-mono text-xs">multiple-rule-disjunction.test-case.ts</code>. The gates
        here behave as criterion (iff) rules, so a failed body rejects its head; a
        sufficient-condition (if) rule would leave the head at "Don't know" instead.
      </p>
    </WidgetShell>
  );
}

function evidenceLines(leafValues: Record<LeafId, GoalValue>): readonly CodeLine[] {
  return LEAVES.flatMap((leaf): readonly CodeLine[] => {
    const atom = EVIDENCE_ATOMS[leaf.id];

    switch (leafValues[leaf.id]) {
      case "true":
        return [{ text: `kb.asserts(${atom});`, tone: "add" }];
      case "false":
        return [{ text: `kb.denies(${atom});`, tone: "remove" }];
      case "conflicted":
        return [
          { text: `kb.asserts(${atom});`, tone: "add" },
          { text: `kb.denies(${atom});`, tone: "remove" },
        ];
      case "unknown":
        return [
          { text: `// nothing recorded for "${leaf.label}" — stays unknown`, tone: "comment" },
        ];
      default:
        return [];
    }
  });
}

function evaluate(leafValues: Record<LeafId, GoalValue>): Record<NodeId, GoalValue> {
  return solveScaffold(GATES, leafValues);
}

function gateTrace(gate: Gate, values: Record<NodeId, GoalValue>): string {
  const value = values[gate.id];
  const word = VERDICT[value].word;
  const controlling = gate.inputs.filter((input) => RANK[values[input]] === RANK[value]);
  const names = formatNames(controlling.map((input) => `"${NODE_LABELS[input]}"`));

  if (controlling.length === gate.inputs.length) {
    return `every input answers "${word}".`;
  }

  return gate.operator === "and"
    ? `weakest link is ${names}, so AND pins it at "${word}".`
    : `strongest route is ${names}, so OR lifts it to "${word}".`;
}
