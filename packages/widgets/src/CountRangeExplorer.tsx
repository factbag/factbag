"use client";

import { useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from "react";
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

import { RuleBox, VerdictCard, WidgetShell } from "./lib/ui";
import { cycleValue, type GoalValue } from "./lib/values";
import { VERDICT } from "./theme";

type Ineq = "gt" | "gte" | "lt" | "lte";

type IncomeRecord = {
  readonly Icon: LucideIcon;
  readonly label: string;
};

type CaseRow = {
  readonly holds: boolean;
  readonly reason: string;
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

const OUTCOMES: Record<GoalValue, string> = {
  false: "Alice can't invest",
  unknown: "Can't say yet",
  conflicted: "Depends who you believe",
  true: "Alice can invest",
};

const OP_ORDER: readonly Ineq[] = ["gte", "gt", "lte", "lt"];

function nextOperator(operator: Ineq): Ineq {
  return OP_ORDER[(OP_ORDER.indexOf(operator) + 1) % OP_ORDER.length] ?? "gte";
}

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
  const [dragging, setDragging] = useState(false);
  const lineRef = useRef<HTMLDivElement>(null);

  const lower = statuses.filter((value) => value === "true").length;
  const conflictedCount = statuses.filter((value) => value === "conflicted").length;
  const unknownCount = statuses.filter((value) => value === "unknown").length;
  const upper = lower + conflictedCount + unknownCount;

  const rows = caseRows(operator, lower, conflictedCount, upper, threshold);
  const activeRow = rows.find((row) => row.holds) ?? rows[0];
  const result: GoalValue = activeRow?.value ?? "unknown";
  const resultMeta = VERDICT[result];

  function cycleRecord(index: number, direction: 1 | -1): void {
    setStatuses((current) =>
      current.map((value, position) => (position === index ? cycleValue(value, direction) : value)),
    );
  }

  function tickAt(clientX: number): number {
    const line = lineRef.current;
    if (!line) {
      return threshold;
    }
    const offset = clientX - line.getBoundingClientRect().left - LINE_PAD;
    return Math.min(MAX_TICK, Math.max(0, Math.round(offset / LINE_STEP)));
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>): void {
    lineRef.current?.setPointerCapture(event.pointerId);
    setDragging(true);
    setThreshold(tickAt(event.clientX));
  }

  return (
    <WidgetShell>
      <RuleBox>
        <strong>The rule:</strong> Alice is eligible to invest if she has {OPS[operator].phrase}{" "}
        {threshold} income sources.
      </RuleBox>
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
        <div
          ref={lineRef}
          className={`relative mx-auto h-33 select-none ${dragging ? "cursor-grabbing" : ""}`}
          style={{ width: LINE_WIDTH }}
          onPointerCancel={() => setDragging(false)}
          onPointerMove={(event) => {
            if (dragging) {
              setThreshold(tickAt(event.clientX));
            }
          }}
          onPointerUp={() => setDragging(false)}
        >
          <button
            aria-label={`Comparison is ${OPS[operator].phrase} ${threshold}. Activate to switch.`}
            className="absolute grid h-8 w-8 -translate-x-1/2 cursor-pointer place-items-center rounded-full border-2 bg-slate-900 text-base font-extrabold text-white shadow transition-all duration-300 hover:scale-110"
            style={{ borderColor: resultMeta.color, left: tickX(threshold), top: 2 }}
            title="Switch comparison"
            type="button"
            onClick={() => setOperator(nextOperator(operator))}
          >
            <span key={operator} className="value-pop">
              {OPS[operator].symbol}
            </span>
          </button>
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
            className="absolute cursor-pointer touch-none overflow-hidden rounded-full bg-slate-200"
            style={{ height: 16, left: tickX(0), top: 56, width: tickX(MAX_TICK) - tickX(0) }}
            onPointerDown={startDrag}
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
              className={`absolute grid h-8 w-8 -translate-x-1/2 touch-none place-items-center rounded-full text-sm transition-all ${
                tick === threshold
                  ? "cursor-grab bg-slate-900 font-extrabold text-white shadow"
                  : "cursor-pointer font-semibold text-slate-500 hover:bg-white hover:shadow"
              }`}
              style={{ left: tickX(tick), top: 86 }}
              type="button"
              onClick={() => setThreshold(tick)}
              onPointerDown={startDrag}
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
      <VerdictCard
        caption={activeRow?.reason}
        className="mx-auto w-fit"
        Icon={resultMeta.Icon}
        title={OUTCOMES[result]}
        value={result}
      />
    </WidgetShell>
  );
}

function caseRows(operator: Ineq, l: number, c: number, u: number, n: number): readonly CaseRow[] {
  switch (operator) {
    case "gte":
      return [
        {
          holds: l >= n,
          reason: "The certain records alone reach the threshold.",
          value: "true",
        },
        {
          holds: u < n,
          reason: "Even counting every disputed and unverified record, the total falls short.",
          value: "false",
        },
        {
          holds: l < n && n <= l + c,
          reason: "The disputed records alone could close the gap.",
          value: "conflicted",
        },
        {
          holds: l < n && n <= u,
          reason: "Closing the gap needs the unverified records — not enough evidence either way.",
          value: "unknown",
        },
      ];
    case "gt":
      return [
        {
          holds: l > n,
          reason: "The certain records alone exceed the threshold.",
          value: "true",
        },
        {
          holds: u <= n,
          reason: "Even counting every disputed and unverified record, the total can't exceed it.",
          value: "false",
        },
        {
          holds: l <= n && n < l + c,
          reason: "The disputed records alone could push the count past it.",
          value: "conflicted",
        },
        {
          holds: l <= n && n < u,
          reason: "Getting past it needs the unverified records — not enough evidence either way.",
          value: "unknown",
        },
      ];
    case "lte":
      return [
        {
          holds: u <= n,
          reason: "Even if every disputed and unverified record counts, the total stays within it.",
          value: "true",
        },
        {
          holds: l > n,
          reason: "The certain records alone already exceed the threshold.",
          value: "false",
        },
        {
          holds: l <= n && n < l + c,
          reason: "Only the disputed records could push the count past it.",
          value: "conflicted",
        },
        {
          holds: l <= n && n < u,
          reason:
            "Pushing past it would need the unverified records — not enough evidence either way.",
          value: "unknown",
        },
      ];
    case "lt":
      return [
        {
          holds: u < n,
          reason: "Even if every disputed and unverified record counts, the total stays under it.",
          value: "true",
        },
        {
          holds: l >= n,
          reason: "The certain records alone already reach the threshold.",
          value: "false",
        },
        {
          holds: l < n && n <= l + c,
          reason: "Only the disputed records could lift the count to it.",
          value: "conflicted",
        },
        {
          holds: l < n && n <= u,
          reason: "Reaching it would need the unverified records — not enough evidence either way.",
          value: "unknown",
        },
      ];
    default:
      throw new Error(`Invalid inequality operator: ${String(operator)}`);
  }
}
