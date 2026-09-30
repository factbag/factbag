"use client";

import { useState, type JSX } from "react";
import { Badge as BadgeIcon, CircleDollarSign, Search, type LucideIcon } from "lucide-react";

import {
  and,
  assertGroundAtom,
  closedPredicate,
  not,
  predicate,
  variable,
} from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, type Judgment } from "@factbag/core/query";

import { CodeBlock, type CodeLine } from "./lib/CodeBlock";
import { DiagramCanvas, FlowEdge, treeCurve } from "./lib/diagram";
import { Hint, InlineCode, RuleBox, WidgetShell } from "./lib/ui";
import { RANK, type GoalValue } from "./lib/values";
import { VERDICT } from "./theme";

class Person {
  constructor(readonly id: string) {}
}

const mia = new Person("mia");
const P = variable("P");

const hasCard = predicate("has_card", { person: Person });
const cardRevoked = closedPredicate("card_revoked", { person: Person });
const cardOk = predicate("card_ok", { person: Person });
const mayBorrow = predicate("may_borrow", { person: Person });

type FilingId = "audit" | "fines" | "frontDesk";

type FilingMeta = {
  readonly citation: string;
  readonly dslLine: string;
  readonly effect: string;
  readonly feeds: "cardRevoked" | "hasCard";
  readonly file: (kb: KnowledgeBase) => void;
  readonly Icon: LucideIcon;
  readonly sign: "+" | "-";
  readonly source: string;
  readonly x: number;
};

const FILINGS: Record<FilingId, FilingMeta> = {
  audit: {
    citation: "Card #4417 never appears in the member ledger.",
    dslLine: 'kb.denies(has_card({ person: mia }), { source: "records_audit" });',
    effect: "− has_card",
    feeds: "hasCard",
    file: (kb) => {
      kb.denies(hasCard({ person: mia }), {
        citation: "Card #4417 never appears in the member ledger.",
        source: "records_audit",
      });
    },
    Icon: Search,
    sign: "-",
    source: "records_audit",
    x: 335,
  },
  fines: {
    citation: "Card #4417 was revoked over unpaid fines.",
    dslLine: 'kb.asserts(card_revoked({ person: mia }), { source: "fines_office" });',
    effect: "+ card_revoked",
    feeds: "cardRevoked",
    file: (kb) => {
      kb.asserts(cardRevoked({ person: mia }), {
        citation: "Card #4417 was revoked over unpaid fines.",
        source: "fines_office",
      });
    },
    Icon: CircleDollarSign,
    sign: "+",
    source: "fines_office",
    x: 590,
  },
  frontDesk: {
    citation: "Mia was issued card #4417 at the front desk.",
    dslLine: 'kb.asserts(has_card({ person: mia }), { source: "front_desk" });',
    effect: "+ has_card",
    feeds: "hasCard",
    file: (kb) => {
      kb.asserts(hasCard({ person: mia }), {
        citation: "Mia was issued card #4417 at the front desk.",
        source: "front_desk",
      });
    },
    Icon: BadgeIcon,
    sign: "+",
    source: "front_desk",
    x: 145,
  },
};

const FILING_IDS: readonly FilingId[] = ["frontDesk", "audit", "fines"];

const FILING_Y = 88;
const ATOM_Y = 262;
const NOT_JUNCTION = { x: 590, y: 338 } as const;
const CARD_OK_POS = { x: 590, y: 400 } as const;
const AND_JUNCTION = { x: 400, y: 474 } as const;
const VERDICT_POS = { x: 400, y: 536 } as const;
const HAS_CARD_POS = { x: 240, y: ATOM_Y } as const;
const CARD_REVOKED_POS = { x: 590, y: ATOM_Y } as const;
const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 604;
const IDLE_HEX = "var(--color-neutral)";

const VERDICTS: Record<GoalValue, string> = {
  conflicted: "Records disagree",
  false: "No — may not borrow",
  true: "Yes — may borrow",
  unknown: "Don't know yet",
};

type TreeJudgments = {
  readonly cardOk: Judgment;
  readonly cardRevoked: Judgment;
  readonly hasCard: Judgment;
  readonly mayBorrow: Judgment;
};

export function solveTree(filed: Record<FilingId, boolean>): TreeJudgments {
  const kb = new KnowledgeBase();

  kb.rule(cardOk({ person: P })).iff(not(cardRevoked({ person: P })));
  kb.rule(mayBorrow({ person: P })).iff(and(hasCard({ person: P }), cardOk({ person: P })));

  for (const id of FILING_IDS) {
    if (filed[id]) {
      FILINGS[id].file(kb);
    }
  }

  const goal = mayBorrow({ person: mia });
  assertGroundAtom(goal);
  const verdict = query(kb, goal);

  // One query; every other node is read out of its proof. The `and` body
  // holds both branch judgments, and card_ok's own rule support holds the
  // negation and the card_revoked leaf beneath it.
  const body = ruleBody(verdict, "may_borrow(mia)");
  const hasCardJudgment = subgoal(body, 0, "and body");
  const cardOkJudgment = subgoal(body, 1, "and body");
  const notBody = ruleBody(cardOkJudgment, "card_ok(mia)");
  const cardRevokedJudgment = subgoal(notBody, 0, "not(card_revoked(mia))");

  return {
    cardOk: cardOkJudgment,
    cardRevoked: cardRevokedJudgment,
    hasCard: hasCardJudgment,
    mayBorrow: verdict,
  };
}

type AnySupport = NonNullable<Judgment["positive"]>[number];

function supportsOf(judgment: Judgment): readonly AnySupport[] {
  return [
    ...(judgment.positive ?? []),
    ...(judgment.negative ?? []),
    ...(judgment.inconclusive ?? []),
  ];
}

function ruleBody(judgment: Judgment, label: string): Judgment {
  const support = supportsOf(judgment).find((entry) => entry.source === "rule");
  if (support === undefined) {
    throw new Error(`Expected a rule support on ${label}`);
  }
  return support.body;
}

function subgoal(judgment: Judgment, index: number, label: string): Judgment {
  const support = supportsOf(judgment).find((entry) => entry.source === "subgoals");
  const child = support?.judgments[index];
  if (child === undefined) {
    throw new Error(`Expected subgoal ${index} on ${label}`);
  }
  return child;
}

export function LiveSolverTree(): JSX.Element {
  const [filed, setFiled] = useState<Record<FilingId, boolean>>({
    audit: false,
    fines: false,
    frontDesk: true,
  });

  const judgments = solveTree(filed);
  const values = {
    cardOk: judgments.cardOk.value,
    cardRevoked: judgments.cardRevoked.value,
    hasCard: judgments.hasCard.value,
    mayBorrow: judgments.mayBorrow.value,
  };

  function toggleFiling(id: FilingId): void {
    setFiled((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <WidgetShell eyebrow="Live solver · tree view" title="Watch the real solver flow">
      <RuleBox>
        <strong>Same live knowledge base, drawn as a tree.</strong> Filings feed the two evidence
        predicates; <InlineCode>card_ok</InlineCode> is a rule head that negates the closed-world
        register, and the verdict conjoins both branches. The whole picture is one{" "}
        <InlineCode>query(kb, …)</InlineCode>: every node&rsquo;s value is read out of the
        verdict&rsquo;s own proof tree — nothing is combined by hand, and nothing is re-queried.
      </RuleBox>
      <Hint>
        Tap a filing card to add or withdraw it. Filed evidence lights its wire; the solver re-runs
        and the colors flow down to the verdict.
      </Hint>
      <DiagramCanvas
        height={GRAPH_HEIGHT}
        svg={[
          ...FILING_IDS.map((id) => {
            const filing = FILINGS[id];
            const to = filing.feeds === "hasCard" ? HAS_CARD_POS : CARD_REVOKED_POS;

            return (
              <FlowEdge
                key={`${id}-edge`}
                active={filed[id]}
                d={treeCurve(filing.x, FILING_Y, to.x, to.y)}
                dashedWhenIdle
                color={VERDICT[filing.sign === "+" ? "true" : "false"].color}
                idleColor={IDLE_HEX}
              />
            );
          }),
          <FlowEdge
            key="revoked-not"
            active
            d={treeCurve(CARD_REVOKED_POS.x, CARD_REVOKED_POS.y, NOT_JUNCTION.x, NOT_JUNCTION.y)}
            color={VERDICT[values.cardRevoked].color}
          />,
          <FlowEdge
            key="not-cardok"
            active
            d={`M ${NOT_JUNCTION.x} ${NOT_JUNCTION.y} L ${CARD_OK_POS.x} ${CARD_OK_POS.y}`}
            color={VERDICT[values.cardOk].color}
          />,
          <FlowEdge
            key="hascard-and"
            active={RANK[values.hasCard] === RANK[values.mayBorrow]}
            d={treeCurve(HAS_CARD_POS.x, HAS_CARD_POS.y, AND_JUNCTION.x, AND_JUNCTION.y)}
            color={VERDICT[values.hasCard].color}
          />,
          <FlowEdge
            key="cardok-and"
            active={RANK[values.cardOk] === RANK[values.mayBorrow]}
            d={treeCurve(CARD_OK_POS.x, CARD_OK_POS.y, AND_JUNCTION.x, AND_JUNCTION.y)}
            color={VERDICT[values.cardOk].color}
          />,
          <FlowEdge
            key="and-verdict"
            active
            d={`M ${AND_JUNCTION.x} ${AND_JUNCTION.y} L ${VERDICT_POS.x} ${VERDICT_POS.y}`}
            color={VERDICT[values.mayBorrow].color}
          />,
        ]}
        width={GRAPH_WIDTH}
      >
        {FILING_IDS.map((id) => {
          const filing = FILINGS[id];
          const active = filed[id];
          const sideMeta = VERDICT[filing.sign === "+" ? "true" : "false"];

          return (
            <button
              key={id}
              aria-pressed={active}
              className={`absolute grid w-37.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer justify-items-center gap-1 rounded-2xl border-2 px-2 py-2 shadow-lg transition-all hover:shadow-xl ${
                active
                  ? `bg-white/95 ${sideMeta.border}`
                  : "border-dashed border-slate-300 bg-white/50 opacity-70 hover:opacity-100"
              }`}
              style={{ left: filing.x, top: FILING_Y }}
              title={filing.citation}
              type="button"
              onClick={() => toggleFiling(id)}
            >
              <filing.Icon className="size-5 text-slate-600" strokeWidth={2.5} />
              <span className="max-w-full truncate font-mono text-2xs font-bold">
                {filing.source}
              </span>
              <span
                className={`font-mono text-2xs leading-none font-bold ${
                  active ? sideMeta.text : "text-slate-400"
                }`}
              >
                {filing.effect}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-2xs leading-none font-extrabold tracking-wide uppercase ${
                  active ? `text-white ${sideMeta.pill}` : "bg-slate-200 text-slate-500"
                }`}
              >
                {active ? "filed" : "not filed"}
              </span>
            </button>
          );
        })}
        <NodeCard code="has_card(mia)" pos={HAS_CARD_POS} value={values.hasCard} />
        <NodeCard
          caption="closed-world"
          code="card_revoked(mia)"
          pos={CARD_REVOKED_POS}
          value={values.cardRevoked}
        />
        <NodeCard
          caption="iff not(card_revoked(P))"
          code="card_ok(mia)"
          pos={CARD_OK_POS}
          value={values.cardOk}
        />
        <Badge label="NOT" x={NOT_JUNCTION.x} y={NOT_JUNCTION.y} />
        <VerdictNode value={values.mayBorrow} />
        <Badge label="AND" x={AND_JUNCTION.x} y={AND_JUNCTION.y} />
      </DiagramCanvas>
      <div className="mt-3 grid gap-1.5 rounded-2xl bg-slate-950/5 p-4">
        <TraceLine label="card_ok" value={values.cardOk}>
          {notTrace(filed, values.cardRevoked)}
        </TraceLine>
        <TraceLine label="may_borrow" value={values.mayBorrow}>
          {andTrace(values)}
        </TraceLine>
      </div>
      <CodeBlock lines={dslLines(filed, values.mayBorrow)} title="The code that just ran" />
      <p className="mt-3 text-sm leading-6 text-slate-500">
        The tree view splits the negation into its own rule head, so even the{" "}
        <InlineCode>NOT</InlineCode> gate is a genuine solver artifact: withdraw the fines filing
        and <InlineCode>card_ok</InlineCode> turns true by closed-world absence — silence in an
        authoritative register is evidence. The diagram is a projection of the verdict&rsquo;s
        single <InlineCode>Judgment</InlineCode>: the solver preserves subproofs even through{" "}
        <InlineCode>unknown</InlineCode> steps, so the branch values are always in the proof — the
        same nested structure the flat widget above renders directly.
      </p>
    </WidgetShell>
  );
}

function NodeCard(props: {
  readonly caption?: string;
  readonly code: string;
  readonly pos: { readonly x: number; readonly y: number };
  readonly value: GoalValue;
}): JSX.Element {
  const meta = VERDICT[props.value];
  const words = VERDICT[props.value];
  const StatusIcon = words.Icon;

  return (
    <div
      className="absolute grid w-42 -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-3 py-2 text-center shadow-lg transition-colors"
      style={{ borderColor: meta.color, left: props.pos.x, top: props.pos.y }}
    >
      <span className="max-w-full truncate font-mono text-2xs leading-none font-bold">
        {props.code}
      </span>
      {props.caption === undefined ? null : (
        <span className="max-w-full truncate font-mono text-2xs leading-none text-slate-400">
          {props.caption}
        </span>
      )}
      <span
        key={props.value}
        className={`value-pop text-sm leading-none font-extrabold ${meta.text}`}
      >
        <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {words.word}
      </span>
    </div>
  );
}

function VerdictNode(props: { readonly value: GoalValue }): JSX.Element {
  const meta = VERDICT[props.value];
  const StatusIcon = VERDICT[props.value].Icon;

  return (
    <div
      className="absolute grid w-52.5 -translate-x-1/2 -translate-y-1/2 justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-3 py-2 text-center shadow-lg transition-colors"
      style={{ borderColor: meta.color, left: VERDICT_POS.x, top: VERDICT_POS.y }}
    >
      <span className="text-xs leading-tight font-bold">May Mia borrow books?</span>
      <span className="max-w-full truncate font-mono text-2xs leading-none text-slate-400">
        may_borrow(mia)
      </span>
      <span
        key={props.value}
        className={`value-pop text-sm leading-none font-extrabold ${meta.text}`}
      >
        <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} />{" "}
        {VERDICTS[props.value]}
      </span>
    </div>
  );
}

function Badge(props: {
  readonly label: string;
  readonly x: number;
  readonly y: number;
}): JSX.Element {
  return (
    <span
      className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs leading-none font-extrabold tracking-wide whitespace-nowrap text-white uppercase shadow-md"
      style={{ left: props.x, top: props.y }}
      title={props.label === "AND" ? "AND — all must pass" : "NOT — flips its input"}
    >
      {props.label}
    </span>
  );
}

function TraceLine(props: {
  readonly children: string;
  readonly label: string;
  readonly value: GoalValue;
}): JSX.Element {
  const meta = VERDICT[props.value];
  const words = VERDICT[props.value];
  const StatusIcon = words.Icon;

  return (
    <p className="text-sm leading-5 text-slate-700">
      <span className={`font-mono font-extrabold ${meta.text}`}>
        <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {props.label}
      </span>{" "}
      — {props.children}
    </p>
  );
}

function notTrace(filed: Record<FilingId, boolean>, revokedValue: GoalValue): string {
  if (!filed.fines) {
    return "the register is closed-world and empty, so card_revoked is a real “No” — and NOT lifts silence into a “Yes”.";
  }
  if (revokedValue === "true") {
    return "the fines office has the revocation on file, and NOT flips that “Yes” into a hard “No”.";
  }
  return `NOT flips card_revoked's “${VERDICT[revokedValue].word}”.`;
}

function andTrace(values: {
  readonly cardOk: GoalValue;
  readonly hasCard: GoalValue;
  readonly mayBorrow: GoalValue;
}): string {
  const controlling = [
    ...(RANK[values.hasCard] === RANK[values.mayBorrow] ? ["has_card"] : []),
    ...(RANK[values.cardOk] === RANK[values.mayBorrow] ? ["card_ok"] : []),
  ];
  const word = VERDICT[values.mayBorrow].word;

  if (controlling.length === 2) {
    return `both branches answer “${word}”, so the verdict follows.`;
  }
  return `weakest link is ${controlling[0] ?? "the body"}, so AND pins the verdict at “${word}”.`;
}

function dslLines(filed: Record<FilingId, boolean>, value: GoalValue): readonly CodeLine[] {
  const lines: CodeLine[] = [
    { text: "const kb = new KnowledgeBase();", tone: "plain" },
    { text: "", tone: "plain" },
    {
      text: "kb.rule(card_ok({ person: P })).iff(not(card_revoked({ person: P })));",
      tone: "plain",
    },
    { text: "kb.rule(may_borrow({ person: P })).iff(", tone: "plain" },
    { text: "  and(has_card({ person: P }), card_ok({ person: P })),", tone: "plain" },
    { text: ");", tone: "plain" },
    { text: "", tone: "plain" },
  ];

  for (const id of FILING_IDS) {
    const filing = FILINGS[id];
    if (filed[id]) {
      lines.push({ text: filing.dslLine, tone: filing.sign === "+" ? "add" : "remove" });
    } else {
      lines.push({ text: `// ${filing.dslLine}`, tone: "comment" });
    }
  }

  lines.push(
    { text: "", tone: "plain" },
    { text: "// one query — the diagram reads every node from its proof", tone: "comment" },
    {
      text: `const verdict = query(kb, may_borrow({ person: mia })); // value: "${value}"`,
      tone: "plain",
    },
  );

  return lines;
}
