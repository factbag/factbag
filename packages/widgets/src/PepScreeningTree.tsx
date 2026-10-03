"use client";

import { useState, type JSX } from "react";
import {
  Building2,
  CalendarClock,
  Landmark,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { CodeBlock, type CodeLine } from "./lib/CodeBlock";
import { DiagramCanvas, FlowEdge, treeCurve } from "./lib/diagram";
import { solveScaffold } from "./lib/live";
import { OperatorBadge, RuleBox, ValueDots, WidgetShell } from "./lib/ui";
import { cycleValue, RANK, type GoalValue, type Operator } from "./lib/values";
import { VERDICT } from "./theme";

type LeafId =
  | "prominent_function"
  | "left_office_recently"
  | "family_of_linked_person"
  | "linked_person_is_pep"
  | "co_owner_with_linked_person";
type GateId = "pep_own_right" | "pep_by_family" | "pep_by_business" | "enhanced_due_diligence";
type NodeId = LeafId | GateId;

type Leaf = {
  readonly Icon: LucideIcon;
  readonly id: LeafId;
  readonly label: string;
  readonly x: number;
};

type Gate = {
  readonly id: GateId;
  readonly inputs: readonly NodeId[];
  readonly label: string;
  readonly operator: Operator;
  readonly x: number;
  readonly y: number;
};

const LEAF_Y = 78;
const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 420;
const JUNCTION_OFFSET = 58;

const LEAVES: readonly Leaf[] = [
  {
    Icon: Landmark,
    id: "prominent_function",
    label: "Holds a prominent public function",
    x: 84,
  },
  {
    Icon: CalendarClock,
    id: "left_office_recently",
    label: "Left office < 12 months ago",
    x: 226,
  },
  {
    Icon: Users,
    id: "family_of_linked_person",
    label: "Immediate family of that person",
    x: 400,
  },
  {
    Icon: UserRoundCheck,
    id: "linked_person_is_pep",
    label: "Linked person is a PEP",
    x: 542,
  },
  {
    Icon: Building2,
    id: "co_owner_with_linked_person",
    label: "Co-owns a company with that person",
    x: 684,
  },
];

/** Ordered so every gate's inputs are evaluated before the gate itself. */
const GATES: readonly Gate[] = [
  {
    id: "pep_own_right",
    inputs: ["prominent_function", "left_office_recently"],
    label: "PEP in her own right",
    operator: "or",
    x: 155,
    y: 222,
  },
  {
    id: "pep_by_family",
    inputs: ["linked_person_is_pep", "family_of_linked_person"],
    label: "PEP by family",
    operator: "and",
    x: 452,
    y: 222,
  },
  {
    id: "pep_by_business",
    inputs: ["linked_person_is_pep", "co_owner_with_linked_person"],
    label: "PEP by business ties",
    operator: "and",
    x: 632,
    y: 222,
  },
  {
    id: "enhanced_due_diligence",
    inputs: ["pep_own_right", "pep_by_family", "pep_by_business"],
    label: "Enhanced due diligence required",
    operator: "or",
    x: 400,
    y: 352,
  },
];

const EVIDENCE_ATOMS: Record<LeafId, string> = {
  family_of_linked_person: "familyMember({ person: dana, of: elena })",
  linked_person_is_pep: "pep({ person: elena })",
  prominent_function: "prominentFunction({ person: dana, role: deputyMinister })",
  co_owner_with_linked_person:
    "jointBeneficialOwner({ person: dana, with: elena, entity: harbourHoldings })",
  left_office_recently: "leftOffice({ person: dana, role: deputyMinister, date: departureDay })",
};

const RULE_LINES: readonly CodeLine[] = [
  { text: "", tone: "plain" },
  {
    text: "// four ways to be a PEP — their contributions combine by OR",
    tone: "comment",
  },
  {
    text: "kb.rule(pep({ person: P })).if(prominentFunction({ person: P, role: Role }));",
    tone: "plain",
  },
  { text: "kb.rule(pep({ person: P })).if(", tone: "plain" },
  { text: "  and(", tone: "plain" },
  { text: "    leftOffice({ person: P, role: Role, date: Departure }),", tone: "plain" },
  {
    text: "    gte(Departure, sub(today, 365 * dayMs)), // still inside the 12-month tail",
    tone: "plain",
  },
  { text: "  ),", tone: "plain" },
  { text: ");", tone: "plain" },
  { text: "kb.rule(pep({ person: P })).if(", tone: "plain" },
  {
    text: "  and(familyMember({ person: P, of: Q }), pep({ person: Q })), // recursive",
    tone: "plain",
  },
  { text: ");", tone: "plain" },
  { text: "kb.rule(pep({ person: P })).if(", tone: "plain" },
  {
    text: "  and(jointBeneficialOwner({ person: P, with: Q, entity: E }), pep({ person: Q })),",
    tone: "plain",
  },
  { text: ");", tone: "plain" },
  { text: "", tone: "plain" },
  { text: "// the top-level criterion rule", tone: "comment" },
  { text: "kb.rule(enhancedDueDiligence({ person: P })).iff(pep({ person: P }));", tone: "plain" },
];

const VERDICTS: Record<GoalValue, string> = {
  false: "No — standard checks",
  unknown: "Need more evidence",
  conflicted: "Records disagree — needs review",
  true: "Yes — enhanced checks",
};

type Position = { readonly x: number; readonly y: number };

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- LEAVES and GATES together enumerate every NodeId; Object.fromEntries erases that key union.
const POSITIONS = Object.fromEntries([
  ...LEAVES.map((leaf) => [leaf.id, { x: leaf.x, y: LEAF_Y }]),
  ...GATES.map((gate) => [gate.id, { x: gate.x, y: gate.y }]),
]) as Record<NodeId, Position>;

export function PepScreeningTree(): JSX.Element {
  const [leafValues, setLeafValues] = useState<Record<LeafId, GoalValue>>({
    co_owner_with_linked_person: "false",
    family_of_linked_person: "conflicted",
    left_office_recently: "unknown",
    linked_person_is_pep: "true",
    prominent_function: "false",
  });

  const values = evaluate(leafValues);

  function cycleLeaf(id: LeafId, direction: 1 | -1): void {
    setLeafValues((current) => ({ ...current, [id]: cycleValue(current[id], direction) }));
  }

  return (
    <WidgetShell>
      <RuleBox>
        <strong>The rule:</strong> Dana needs enhanced due diligence if she is a politically exposed
        person. She is one in her own right if she holds a prominent public function{" "}
        <strong>OR</strong> left one less than 12 months ago; she is one by association if she is
        immediate family of a PEP, <strong>OR</strong> a joint beneficial owner with one.{" "}
        <strong>ANY</strong> of those routes is enough.
      </RuleBox>
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
          const isVerdict = gate.id === "enhanced_due_diligence";

          return (
            <div
              key={gate.id}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-3 py-2 text-center shadow-lg transition-colors ${
                isVerdict ? "w-52.5" : "w-40"
              }`}
              style={{ borderColor: meta.color, left: gate.x, top: gate.y }}
            >
              <span className="text-xs leading-tight font-bold">{gate.label}</span>
              <span
                key={value}
                className={`value-pop text-sm leading-none font-extrabold ${meta.text}`}
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
      <CodeBlock
        lines={[
          { text: "// evidence", tone: "comment" },
          ...evidenceLines(leafValues),
          ...RULE_LINES,
        ]}
      />
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
