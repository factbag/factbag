"use client";

import { useState, type JSX } from "react";
import { ClipboardList, Scale, type LucideIcon } from "lucide-react";

import { assertGroundAtom, closedPredicate, not, predicate, variable } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, type Judgment } from "@factbag/core/query";
import { explainJudgment, type Explanation } from "@factbag/core/explain";

import { CodeBlock, jsonLines } from "./lib/CodeBlock";
import { ProofTree } from "./kb/proof-tree";
import { Hint, InlineCode, RuleBox, WidgetShell } from "./lib/ui";
import { VERDICT } from "./theme";

class Person {
  constructor(readonly id: string) {}
}

const drew = new Person("drew");
const P = variable("P");

const activeSanction = closedPredicate("active_sanction", { person: Person });
const eligible = predicate("eligible", { person: Person });

type SourceId = "appeals" | "registry";

type SourceMeta = {
  readonly action: string;
  readonly file: (kb: KnowledgeBase) => void;
  readonly Icon: LucideIcon;
  readonly name: string;
  readonly quote: string;
  readonly side: "false" | "true";
};

const SOURCES: Record<SourceId, SourceMeta> = {
  appeals: {
    action: "denies active_sanction(drew)",
    file: (kb) => {
      kb.denies(activeSanction({ person: drew }), {
        citation: "Drew's sanction was overturned on appeal.",
        source: "appeals_board",
      });
    },
    Icon: Scale,
    name: "appeals_board",
    quote: "Drew's sanction was overturned on appeal.",
    side: "false",
  },
  registry: {
    action: "asserts active_sanction(drew)",
    file: (kb) => {
      kb.asserts(activeSanction({ person: drew }), {
        citation: "Drew appears on the active sanctions list.",
        source: "sanctions_registry",
      });
    },
    Icon: ClipboardList,
    name: "sanctions_registry",
    quote: "Drew appears on the active sanctions list.",
    side: "true",
  },
};

const SOURCE_IDS: readonly SourceId[] = ["registry", "appeals"];

type SolveResult = {
  readonly explanation: Explanation;
  readonly judgment: Judgment;
};

export function solve(filed: Record<SourceId, boolean>): SolveResult {
  const kb = new KnowledgeBase();

  kb.rule(eligible({ person: P })).iff(not(activeSanction({ person: P })));

  for (const id of SOURCE_IDS) {
    if (filed[id]) {
      SOURCES[id].file(kb);
    }
  }

  const goal = eligible({ person: drew });
  assertGroundAtom(goal);
  const judgment = query(kb, goal);

  return { explanation: explainJudgment(judgment), judgment };
}

export function ProofTreeExplorer(): JSX.Element {
  const [filed, setFiled] = useState<Record<SourceId, boolean>>({
    appeals: true,
    registry: true,
  });

  const { explanation, judgment } = solve(filed);

  function toggleSource(id: SourceId): void {
    setFiled((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <WidgetShell eyebrow="Proof trees" title="Why did the system decide that?">
      <RuleBox>
        <strong>The rule, in English:</strong> a person is eligible when — and only when — they have
        no active sanction on file. <InlineCode>active_sanction</InlineCode> is closed-world: the
        registry is authoritative, so a missing filing is a real &ldquo;no sanction&rdquo;, not a
        shrug.
      </RuleBox>
      <Hint>
        Tap a filing to add or withdraw it, and watch the proof reshape itself. Each change rebuilds
        the knowledge base and re-runs <InlineCode>query(kb, …)</InlineCode> — the tree below is the
        judgment the solver returned. Inside it, tap{" "}
        <span className="font-mono font-bold">▾ because</span> to fold a branch away — an
        explanation stays useful at any depth.
      </Hint>
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {SOURCE_IDS.map((id) => {
          const source = SOURCES[id];
          const active = filed[id];
          const sideMeta = VERDICT[source.side];

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
              onClick={() => toggleSource(id)}
            >
              <span className="flex items-center gap-2">
                <source.Icon className="size-5 text-slate-600" strokeWidth={2.5} />
                <span className="font-mono text-xs font-bold">{source.name}</span>
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
                {source.side === "true" ? "+" : "−"} {source.action}
              </span>
              <span
                className={`mt-1 block text-xs italic ${
                  active ? "text-slate-600" : "text-slate-400"
                }`}
              >
                &ldquo;{source.quote}&rdquo;
              </span>
            </button>
          );
        })}
      </div>
      <p className="mb-2 font-mono text-2xs font-bold tracking-widest text-slate-400 uppercase">
        The proof tree · conclusion at the root, evidence at the leaves
      </p>
      <ProofTree judgment={judgment} />
      <p className="mt-4 text-sm leading-6 text-slate-700">{explainState(filed)}</p>
      <CodeBlock lines={jsonLines(explanation)} title="The same tree as JSON · handed to an LLM" />
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Every node answers the same three questions: <InlineCode>claim</InlineCode> — what was
        decided, <InlineCode>because</InlineCode> — the rule or evidence that decided it, and{" "}
        <InlineCode>given</InlineCode> — the subproofs it stands on. Nothing here is scripted: the
        tree renders the solver&rsquo;s own <InlineCode>Judgment</InlineCode> structure, and the
        JSON is <InlineCode>explainJudgment</InlineCode> called on it live. The verdict itself is a
        single lattice value, but the explanation preserves the provenance behind it, quotes and
        all.
      </p>
    </WidgetShell>
  );
}

function explainState(filed: Record<SourceId, boolean>): string {
  if (filed.registry && filed.appeals) {
    return 'Two accepted filings disagree, so the evidence leaf turns conflicted — and nothing above it can wash that out: not(!) is still !, and the criterion rule passes it through. The tree keeps both quotes, so a reader (or an LLM) sees exactly which sources need resolving instead of a bare "!".';
  }
  if (filed.registry) {
    return 'The registry filing makes the sanction true, not(…) flips it to false, and the criterion rule carries the rejection to the root. Read top-down, each node answers "why?" for the one above it — the tree is the paper trail for the "no".';
  }
  if (filed.appeals) {
    return "The only filing on record denies the sanction, so the proof bottoms out in quoted evidence. Drew is eligible for the same reason as an empty registry would give — but with a different proof. Withdraw this filing too and compare the two trees.";
  }
  return 'Nobody has filed anything — and that is not an unknown. Because the registry is closed-world, silence counts as evidence: the proof bottoms out in a terminal "nothing on file" step, and the tree is at its shortest.';
}
