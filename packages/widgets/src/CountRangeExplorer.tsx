"use client";

import { useState, type JSX } from "react";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  FileText,
  House,
  Music,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";

import { ChoicePill, Hint, RuleBox, ValueLadder, WidgetShell } from "./lib/ui";
import { cycleValue, type GoalValue } from "./lib/values";
import { VERDICT } from "./theme";

type Ineq = "gt" | "gte" | "lt" | "lte";

type IncomeRecord = {
  readonly Icon: LucideIcon;
  readonly label: string;
};

type CaseRow = {
  readonly cond: string;
  readonly holds: boolean;
  readonly reason: string;
  readonly sub: string;
  readonly value: GoalValue;
};

const RECORDS: readonly IncomeRecord[] = [
  { Icon: FileText, label: "W-2 salary" },
  { Icon: House, label: "Rental unit" },
  { Icon: TrendingUp, label: "Stock dividends" },
  { Icon: FileText, label: "Consulting invoices" },
  { Icon: Music, label: "Music royalties" },
  { Icon: Building2, label: "Trust payout" },
];

const RECORD_WORDS: Record<GoalValue, { readonly Icon: LucideIcon; readonly word: string }> = {
  false: { Icon: X, word: "Not hers" },
  unknown: { Icon: CircleQuestionMark, word: "Unverified" },
  conflicted: { Icon: CircleAlert, word: "Disputed" },
  true: { Icon: CircleCheck, word: "Counts" },
};

const OPS: Record<Ineq, { readonly phrase: string; readonly symbol: string }> = {
  gt: { phrase: "more than", symbol: ">" },
  gte: { phrase: "at least", symbol: "≥" },
  lt: { phrase: "fewer than", symbol: "<" },
  lte: { phrase: "at most", symbol: "≤" },
};

const OP_ORDER: readonly Ineq[] = ["gte", "gt", "lte", "lt"];

const MAX_TICK = 7;
const LINE_PAD = 26;
const LINE_STEP = 84;
const LINE_WIDTH = 640;

function tickX(count: number): number {
  return LINE_PAD + count * LINE_STEP;
}

export function CountRangeExplorer(): JSX.Element {
  const [statuses, setStatuses] = useState<readonly GoalValue[]>([
    "true",
    "true",
    "conflicted",
    "unknown",
    "false",
    "false",
  ]);
  const [operator, setOperator] = useState<Ineq>("gte");
  const [threshold, setThreshold] = useState(3);

  const lower = statuses.filter((value) => value === "true").length;
  const conflictedCount = statuses.filter((value) => value === "conflicted").length;
  const unknownCount = statuses.filter((value) => value === "unknown").length;
  const upper = lower + conflictedCount + unknownCount;

  const rows = caseRows(operator, lower, conflictedCount, upper, threshold);
  const activeIndex = rows.findIndex((row) => row.holds);
  const activeRow = rows[activeIndex] ?? rows[0];
  const result: GoalValue = activeRow?.value ?? "unknown";
  const resultMeta = VERDICT[result];

  function cycleRecord(index: number, direction: 1 | -1): void {
    setStatuses((current) =>
      current.map((value, position) => (position === index ? cycleValue(value, direction) : value)),
    );
  }

  return (
    <WidgetShell>
      <RuleBox>
        <strong>The rule:</strong> count Alice's income records and compare the count to a
        threshold. Certain records definitely count. Disputed records <em>might</em> count — someone
        says yes, someone says no. Unverified ones might too — nobody has checked. So the count
        isn't one number; it's a range from the certain count up to "everything counts".
      </RuleBox>
      <Hint>
        Tap a record to change its status. Click a number on the line to move the threshold, and
        pick a comparison.
      </Hint>
      <div className="mb-4 flex flex-wrap gap-2">
        {RECORDS.map((record, index) => {
          const value = statuses[index] ?? "unknown";
          const meta = VERDICT[value];
          const words = RECORD_WORDS[value];
          const StatusIcon = words.Icon;

          return (
            <button
              key={record.label}
              aria-label={`${record.label}: ${words.word}. Activate to change the status.`}
              className={`grid w-24.5 cursor-pointer justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-1.5 py-2 shadow-md transition-colors hover:shadow-lg ${meta.border}`}
              type="button"
              onClick={(event) => cycleRecord(index, event.shiftKey ? -1 : 1)}
            >
              <record.Icon className="size-5 text-slate-600" strokeWidth={2.5} />
              <span className="min-h-7 text-center text-xs leading-tight font-bold">
                {record.label}
              </span>
              <span
                key={value}
                className={`value-pop text-xs leading-none font-extrabold ${meta.text}`}
              >
                <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {words.word}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mb-1 text-center font-mono text-sm text-slate-700">
        R = [l, u] = [{lower}, {upper}] — {lower} certain + {conflictedCount} disputed +{" "}
        {unknownCount} unverified
      </p>
      <p className="mb-2 text-center font-mono text-sm font-bold text-slate-900">
        count(income_fact rows for alice) {OPS[operator].symbol} {threshold} ={" "}
        <span className={resultMeta.text}>
          {VERDICT[result].symbol} {VERDICT[result].label}
        </span>
      </p>
      <div className="overflow-x-auto">
        <div className="relative mx-auto h-33" style={{ width: LINE_WIDTH }}>
          <div
            className="absolute flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 bg-white px-2.5 py-1 text-xs font-extrabold whitespace-nowrap shadow transition-all duration-300"
            style={{ borderColor: resultMeta.color, left: tickX(threshold), top: 4 }}
          >
            n = {threshold}
            {(() => {
              const Icon = VERDICT[result].Icon;
              return <Icon className={`size-3.5 ${resultMeta.text}`} strokeWidth={3} />;
            })()}
          </div>
          <div
            className="absolute w-1 -translate-x-1/2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: resultMeta.color,
              height: 44,
              left: tickX(threshold),
              top: 34,
            }}
          />
          <div
            className="absolute overflow-hidden rounded-full bg-slate-200"
            style={{ height: 16, left: tickX(0), top: 56, width: tickX(MAX_TICK) - tickX(0) }}
          >
            <div
              className="absolute inset-y-0 bg-positive transition-all duration-300"
              style={{ left: 0, width: lower * LINE_STEP }}
            />
            <div
              className="absolute inset-y-0 bg-attention transition-all duration-300"
              style={{ left: lower * LINE_STEP, width: conflictedCount * LINE_STEP }}
            />
            <div
              className="absolute inset-y-0 bg-warning transition-all duration-300"
              style={{
                left: (lower + conflictedCount) * LINE_STEP,
                width: unknownCount * LINE_STEP,
              }}
            />
          </div>
          {Array.from({ length: MAX_TICK + 1 }, (_, tick) => (
            <button
              key={tick}
              aria-label={`Set the threshold to ${tick}`}
              className={`absolute grid h-8 w-8 -translate-x-1/2 cursor-pointer place-items-center rounded-full text-sm transition-all ${
                tick === threshold
                  ? "bg-slate-900 font-extrabold text-white shadow"
                  : "font-semibold text-slate-500 hover:bg-white hover:shadow"
              }`}
              style={{ left: tickX(tick), top: 86 }}
              type="button"
              onClick={() => setThreshold(tick)}
            >
              {tick}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-positive" /> certain (l)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-attention" /> disputed (+C)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> unverified (+U)
        </span>
      </div>
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {OP_ORDER.map((op) => (
          <ChoicePill key={op} selected={op === operator} onClick={() => setOperator(op)}>
            {OPS[op].symbol} {OPS[op].phrase} {threshold}
          </ChoicePill>
        ))}
      </div>
      <div className="grid gap-1.5 rounded-2xl bg-slate-950/5 p-4">
        {rows.map((row, index) => {
          const meta = VERDICT[row.value];
          const isActive = index === activeIndex;

          return (
            <div
              key={row.value}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-3 py-2 transition-all ${
                isActive ? "bg-white shadow" : "opacity-45"
              }`}
              style={{ borderColor: isActive ? meta.color : "transparent" }}
            >
              <span
                className={`inline-flex w-28 justify-center rounded-full px-2.5 py-1.5 text-xs leading-none font-extrabold whitespace-nowrap text-white ${meta.pill}`}
              >
                {meta.symbol} {VERDICT[row.value].word}
              </span>
              <span className="font-mono text-sm text-slate-700">{row.cond}</span>
              {isActive ? (
                <>
                  <span className="font-mono text-sm font-bold text-slate-900">→ {row.sub}</span>
                  <span className="basis-full text-sm leading-5 text-slate-600">{row.reason}</span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Why "Disagree" only when the dispute alone crosses the line: alternative ways to cross
        combine by OR, and ! ∨ ? = !. If crossing needs the disputed <em>and</em> the unverified
        records together, that's conjunction — ! ∧ ? = ? — so the answer stays "Don't know".
      </p>
      <ValueLadder lead="symbol" />
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Semantics from <code className="font-mono text-xs">docs/formalized/inequalities.md</code>;
        count ranges like this arise from aggregates over evidence rows — see{" "}
        <code className="font-mono text-xs">scenarios/accredited-investor.ts</code> and{" "}
        <code className="font-mono text-xs">aggregate-count-interval.test-case.ts</code>. Open-world
        counts have an unbounded upper range [l, ∞]: the cases that depend on u can never fire, and
        that uncertainty contributes "Don't know" instead.
      </p>
    </WidgetShell>
  );
}

function caseRows(operator: Ineq, l: number, c: number, u: number, n: number): readonly CaseRow[] {
  switch (operator) {
    case "gte":
      return [
        {
          cond: "l ≥ n",
          holds: l >= n,
          reason: "The certain records alone reach the threshold.",
          sub: `${l} ≥ ${n}`,
          value: "true",
        },
        {
          cond: "u < n",
          holds: u < n,
          reason: "Even counting every disputed and unverified record, the total falls short.",
          sub: `${u} < ${n}`,
          value: "false",
        },
        {
          cond: "l < n ≤ l + C",
          holds: l < n && n <= l + c,
          reason: "The disputed records alone could close the gap — the dispute decides.",
          sub: `${l} < ${n} ≤ ${l + c}`,
          value: "conflicted",
        },
        {
          cond: "l < n ≤ u",
          holds: l < n && n <= u,
          reason: "Closing the gap needs the unverified records — not enough evidence either way.",
          sub: `${l} < ${n} ≤ ${u}`,
          value: "unknown",
        },
      ];
    case "gt":
      return [
        {
          cond: "l > n",
          holds: l > n,
          reason: "The certain records alone exceed the threshold.",
          sub: `${l} > ${n}`,
          value: "true",
        },
        {
          cond: "u ≤ n",
          holds: u <= n,
          reason: "Even counting every disputed and unverified record, the total can't exceed it.",
          sub: `${u} ≤ ${n}`,
          value: "false",
        },
        {
          cond: "l ≤ n < l + C",
          holds: l <= n && n < l + c,
          reason: "The disputed records alone could push the count past it — the dispute decides.",
          sub: `${l} ≤ ${n} < ${l + c}`,
          value: "conflicted",
        },
        {
          cond: "l ≤ n < u",
          holds: l <= n && n < u,
          reason: "Getting past it needs the unverified records — not enough evidence either way.",
          sub: `${l} ≤ ${n} < ${u}`,
          value: "unknown",
        },
      ];
    case "lte":
      return [
        {
          cond: "u ≤ n",
          holds: u <= n,
          reason: "Even if every disputed and unverified record counts, the total stays within it.",
          sub: `${u} ≤ ${n}`,
          value: "true",
        },
        {
          cond: "l > n",
          holds: l > n,
          reason: "The certain records alone already exceed the threshold.",
          sub: `${l} > ${n}`,
          value: "false",
        },
        {
          cond: "l ≤ n < l + C",
          holds: l <= n && n < l + c,
          reason: "Only the disputed records could push the count past it — the dispute decides.",
          sub: `${l} ≤ ${n} < ${l + c}`,
          value: "conflicted",
        },
        {
          cond: "l ≤ n < u",
          holds: l <= n && n < u,
          reason:
            "Pushing past it would need the unverified records — not enough evidence either way.",
          sub: `${l} ≤ ${n} < ${u}`,
          value: "unknown",
        },
      ];
    case "lt":
      return [
        {
          cond: "u < n",
          holds: u < n,
          reason: "Even if every disputed and unverified record counts, the total stays under it.",
          sub: `${u} < ${n}`,
          value: "true",
        },
        {
          cond: "l ≥ n",
          holds: l >= n,
          reason: "The certain records alone already reach the threshold.",
          sub: `${l} ≥ ${n}`,
          value: "false",
        },
        {
          cond: "l < n ≤ l + C",
          holds: l < n && n <= l + c,
          reason: "Only the disputed records could lift the count to it — the dispute decides.",
          sub: `${l} < ${n} ≤ ${l + c}`,
          value: "conflicted",
        },
        {
          cond: "l < n ≤ u",
          holds: l < n && n <= u,
          reason: "Reaching it would need the unverified records — not enough evidence either way.",
          sub: `${l} < ${n} ≤ ${u}`,
          value: "unknown",
        },
      ];
    default:
      throw new Error(`Invalid inequality operator: ${String(operator)}`);
  }
}
