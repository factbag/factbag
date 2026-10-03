"use client";

import { useState, type JSX } from "react";
import { Badge, CircleDollarSign, Search, type LucideIcon } from "lucide-react";

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
import { explainJudgment, type Explanation } from "@factbag/core/explain";

import { CodeBlock, jsonLines, type CodeLine } from "./lib/CodeBlock";
import { ProofTree } from "./kb/proof-tree";
import { Hint, InlineCode, RuleBox, WidgetShell } from "./lib/ui";
import type { GoalValue } from "./lib/values";
import { VERDICT } from "./theme";

class Person {
  constructor(readonly id: string) {}
}

const mia = new Person("mia");
const P = variable("P");

const hasCard = predicate("has_card", { person: Person });
const cardRevoked = closedPredicate("card_revoked", { person: Person });
const mayBorrow = predicate("may_borrow", { person: Person });

type FilingId = "audit" | "fines" | "frontDesk";

type FilingMeta = {
  readonly citation: string;
  readonly dslLine: string;
  readonly effect: string;
  readonly file: (kb: KnowledgeBase) => void;
  readonly Icon: LucideIcon;
  readonly sign: "+" | "-";
  readonly source: string;
};

const FILINGS: Record<FilingId, FilingMeta> = {
  audit: {
    citation: "Card #4417 never appears in the member ledger.",
    dslLine: 'kb.denies(has_card({ person: mia }), { source: "records_audit" });',
    effect: "denies has_card(mia)",
    file: (kb) => {
      kb.denies(hasCard({ person: mia }), {
        citation: "Card #4417 never appears in the member ledger.",
        source: "records_audit",
      });
    },
    Icon: Search,
    sign: "-",
    source: "records_audit",
  },
  fines: {
    citation: "Card #4417 was revoked over unpaid fines.",
    dslLine: 'kb.asserts(card_revoked({ person: mia }), { source: "fines_office" });',
    effect: "asserts card_revoked(mia)",
    file: (kb) => {
      kb.asserts(cardRevoked({ person: mia }), {
        citation: "Card #4417 was revoked over unpaid fines.",
        source: "fines_office",
      });
    },
    Icon: CircleDollarSign,
    sign: "+",
    source: "fines_office",
  },
  frontDesk: {
    citation: "Mia was issued card #4417 at the front desk.",
    dslLine: 'kb.asserts(has_card({ person: mia }), { source: "front_desk" });',
    effect: "asserts has_card(mia)",
    file: (kb) => {
      kb.asserts(hasCard({ person: mia }), {
        citation: "Mia was issued card #4417 at the front desk.",
        source: "front_desk",
      });
    },
    Icon: Badge,
    sign: "+",
    source: "front_desk",
  },
};

const FILING_IDS: readonly FilingId[] = ["frontDesk", "audit", "fines"];

type SolveResult = {
  readonly explanation: Explanation;
  readonly judgment: Judgment;
};

export function solve(filed: Record<FilingId, boolean>): SolveResult {
  const kb = new KnowledgeBase();

  kb.rule(mayBorrow({ person: P })).iff(
    and(hasCard({ person: P }), not(cardRevoked({ person: P }))),
  );

  for (const id of FILING_IDS) {
    if (filed[id]) {
      FILINGS[id].file(kb);
    }
  }

  const goal = mayBorrow({ person: mia });
  assertGroundAtom(goal);
  const judgment = query(kb, goal);

  return { explanation: explainJudgment(judgment), judgment };
}

export function LiveSolverExplorer(): JSX.Element {
  const [filed, setFiled] = useState<Record<FilingId, boolean>>({
    audit: false,
    fines: false,
    frontDesk: true,
  });

  const { explanation, judgment } = solve(filed);

  function toggleFiling(id: FilingId): void {
    setFiled((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <WidgetShell eyebrow="Live solver" title="This proof was computed, not drawn">
      <RuleBox>
        <strong>Nothing here is drawn by hand.</strong> This widget runs the real{" "}
        <InlineCode>@factbag/core</InlineCode> solver in your browser. The rule: Mia may borrow
        books when — and only when — she holds a library card and it has not been revoked.{" "}
        <InlineCode>has_card</InlineCode> is open-world (nobody keeps a complete list), while{" "}
        <InlineCode>card_revoked</InlineCode> is closed-world (the fines office is authoritative, so
        an empty file is a real &ldquo;not revoked&rdquo;).
      </RuleBox>
      <Hint>
        Tap a filing to add or withdraw it. Each change rebuilds the knowledge base, re-runs{" "}
        <InlineCode>query(kb, …)</InlineCode>, and re-renders the judgment the solver actually
        returned.
      </Hint>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {FILING_IDS.map((id) => {
          const filing = FILINGS[id];
          const active = filed[id];
          const sideMeta = VERDICT[filing.sign === "+" ? "true" : "false"];

          return (
            <button
              key={id}
              aria-pressed={active}
              className={`cursor-pointer rounded-2xl border-2 px-4 py-3 text-left shadow-sm transition-all ${
                active
                  ? `bg-white/95 shadow-md ${sideMeta.border}`
                  : "border-dashed border-slate-300 bg-white/40 opacity-70 hover:opacity-100"
              }`}
              type="button"
              onClick={() => toggleFiling(id)}
            >
              <span className="flex items-center gap-2">
                <filing.Icon className="size-5 text-slate-600" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold">{filing.source}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-1 text-2xs leading-none font-extrabold tracking-wide uppercase ${
                    active ? `text-white ${sideMeta.pill}` : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {active ? "filed" : "not filed"}
                </span>
              </span>
              <span
                className={`mt-1.5 block font-mono text-xs font-bold ${
                  active ? sideMeta.text : "text-slate-400"
                }`}
              >
                {filing.sign === "+" ? "+" : "−"} {filing.effect}
              </span>
              <span
                className={`mt-1 block text-xs italic ${
                  active ? "text-slate-600" : "text-slate-400"
                }`}
              >
                &ldquo;{filing.citation}&rdquo;
              </span>
            </button>
          );
        })}
      </div>
      <CodeBlock lines={dslLines(filed, judgment.value)} title="The code that just ran" />
      <p className="mt-4 mb-2 font-mono text-2xs font-bold tracking-widest text-slate-400 uppercase">
        The judgment the solver returned · conclusion at the root, evidence at the leaves
      </p>
      <ProofTree judgment={judgment} />
      <p className="mt-4 text-sm leading-6 text-slate-700">{explainState(filed, judgment.value)}</p>
      <CodeBlock lines={jsonLines(explanation)} title="explainJudgment(verdict) · live output" />
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Nothing above is scripted: the tree is the solver&rsquo;s own{" "}
        <InlineCode>Judgment</InlineCode> structure, and the JSON is{" "}
        <InlineCode>explainJudgment</InlineCode> called on it. The quotes in the tree ride along as
        evidence metadata on each literal — provenance survives all the way from{" "}
        <InlineCode>kb.asserts(…)</InlineCode> to the verdict.
      </p>
    </WidgetShell>
  );
}

function dslLines(filed: Record<FilingId, boolean>, value: GoalValue): readonly CodeLine[] {
  const lines: CodeLine[] = [
    { text: "const kb = new KnowledgeBase();", tone: "plain" },
    { text: "", tone: "plain" },
    { text: "kb.rule(may_borrow({ person: P })).iff(", tone: "plain" },
    { text: "  and(has_card({ person: P }), not(card_revoked({ person: P }))),", tone: "plain" },
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
    {
      text: `const verdict = query(kb, may_borrow({ person: mia })); // value: "${value}"`,
      tone: "plain",
    },
  );

  return lines;
}

function explainState(filed: Record<FilingId, boolean>, value: GoalValue): string {
  if (value === "unknown") {
    return "Nothing is on file for has_card, and has_card is open-world — silence is not evidence there. The solver refuses to guess: the rule body comes back unknown, so the verdict is a genuine “we can’t tell”, not a quiet default.";
  }
  if (value === "true") {
    return "The front desk filing proves the card, and the revocation register — closed-world and empty — makes not(card_revoked) true by absence. and() of two trues is true, and the iff rule carries it to the root. Every step above was computed by the solver you just reconfigured.";
  }
  if (value === "conflicted") {
    return "Two accepted filings disagree about the card, so has_card turns conflicted — and and() with a true preserves the conflict. The judgment keeps both literals, quotes attached, so the disagreement is inspectable instead of silently resolved.";
  }
  if (filed.fines) {
    return "The revocation filing makes not(card_revoked) false, and and() takes the worst value of its parts — so even a proven (or contested) card cannot rescue the verdict. A hard “no” anywhere in a conjunction sinks the whole thing.";
  }
  return "The audit denial is the only word on the card, so has_card is false outright. The conjunction fails on its first leg, and the iff rule turns that failure into a definite “no” at the root.";
}
