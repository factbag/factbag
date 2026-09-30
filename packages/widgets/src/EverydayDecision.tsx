"use client";

import { useState, type JSX } from "react";
import {
  Bot,
  CalendarClock,
  Frown,
  Repeat,
  Siren,
  Smile,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { DiagramCanvas, FlowEdge, treeCurve } from "./lib/diagram";
import { solveScaffold } from "./lib/live";
import { ChoicePill, OperatorBadge, RuleBox, ValueDots, VerdictCard, WidgetShell } from "./lib/ui";
import { cycleValue, RANK, type GoalValue, type Operator } from "./lib/values";
import { VERDICT } from "./theme";

type ScenarioKey = "escalate" | "review";

type Check = {
  readonly Icon: LucideIcon;
  readonly label: string;
};

type Scenario = {
  readonly checks: readonly Check[];
  readonly defaults: readonly GoalValue[];
  readonly operator: Operator;
  readonly rule: string;
  readonly tabLabel: string;
  readonly verdicts: Record<GoalValue, string>;
};

const SCENARIOS: Record<ScenarioKey, Scenario> = {
  escalate: {
    checks: [
      { Icon: Frown, label: "Sounds upset" },
      { Icon: Siren, label: "Needs it urgently" },
      { Icon: UserRound, label: "Asked for a human" },
      { Icon: Bot, label: "Bot out of its depth" },
    ],
    defaults: ["conflicted", "false", "false", "unknown"],
    operator: "or",
    rule: "Hand the conversation to a person if the customer sounds upset, or needs it urgently, or asks for a human, or the bot is out of its depth.",
    tabLabel: "Hand this to a person?",
    verdicts: {
      false: "The bot's got this",
      unknown: "Not enough to go on yet",
      conflicted: "Signals disagree — a person should look",
      true: "Passing you to a person",
    },
  },
  review: {
    checks: [
      { Icon: Smile, label: "Seems happy" },
      { Icon: Wrench, label: "Problem fixed" },
      { Icon: Repeat, label: "Planning to return" },
      { Icon: CalendarClock, label: "Not asked recently" },
    ],
    defaults: ["true", "unknown", "true", "true"],
    operator: "and",
    rule: "Ask for a review only when the customer seems happy, the problem is confirmed fixed, they say they'll be back, and we haven't asked recently.",
    tabLabel: "Ask for a review?",
    verdicts: {
      false: "Don't ask",
      unknown: "Too soon to tell",
      conflicted: "Mixed signals — leave it",
      true: "Ask now",
    },
  },
};

const SCENARIO_KEYS: readonly ScenarioKey[] = ["escalate", "review"];
const CARD_XS: readonly number[] = [80, 240, 400, 560];
const CARD_Y = 74;
const HUB_X = 320;
const HUB_Y = 228;
const VERDICT_Y = 314;
const GRAPH_WIDTH = 640;
const GRAPH_HEIGHT = 370;

export function EverydayDecision(): JSX.Element {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("escalate");
  const [answers, setAnswers] = useState<Record<ScenarioKey, readonly GoalValue[]>>({
    escalate: SCENARIOS.escalate.defaults,
    review: SCENARIOS.review.defaults,
  });

  const scenario = SCENARIOS[scenarioKey];
  const statuses = answers[scenarioKey];
  const connector = scenario.operator === "and" ? "AND" : "OR";
  const result = solveScaffold(
    [
      {
        id: "verdict",
        inputs: ["check_1", "check_2", "check_3", "check_4"],
        operator: scenario.operator,
      },
    ],
    {
      check_1: statuses[0] ?? "unknown",
      check_2: statuses[1] ?? "unknown",
      check_3: statuses[2] ?? "unknown",
      check_4: statuses[3] ?? "unknown",
    },
  ).verdict;
  const resultWords = VERDICT[result];

  function cycleAnswer(index: number, direction: 1 | -1): void {
    setAnswers((current) => ({
      ...current,
      [scenarioKey]: current[scenarioKey].map((value, position) =>
        position === index ? cycleValue(value, direction) : value,
      ),
    }));
  }

  return (
    <WidgetShell>
      <div className="mb-3 flex flex-wrap gap-2">
        {SCENARIO_KEYS.map((key) => (
          <ChoicePill key={key} selected={key === scenarioKey} onClick={() => setScenarioKey(key)}>
            {SCENARIOS[key].tabLabel}
          </ChoicePill>
        ))}
      </div>
      <RuleBox>
        <strong>The rule:</strong> {scenario.rule}
      </RuleBox>
      <DiagramCanvas
        height={GRAPH_HEIGHT}
        svg={
          <>
            {statuses.map((value, index) => (
              <FlowEdge
                key={scenario.checks[index]?.label}
                active={RANK[value] === RANK[result]}
                d={treeCurve(CARD_XS[index] ?? 0, CARD_Y, HUB_X, HUB_Y)}
                color={VERDICT[value].color}
              />
            ))}
            <FlowEdge
              active
              d={`M ${HUB_X} ${HUB_Y} L ${HUB_X} ${VERDICT_Y}`}
              color={VERDICT[result].color}
            />
          </>
        }
        width={GRAPH_WIDTH}
      >
        {statuses.map((value, index) => {
          const check = scenario.checks[index];
          const meta = VERDICT[value];
          const words = VERDICT[value];
          const StatusIcon = words.Icon;

          if (!check) {
            return null;
          }

          return (
            <button
              key={check.label}
              aria-label={`${check.label}: ${words.word}. Activate to change the answer.`}
              className={`absolute grid w-31 -translate-x-1/2 -translate-y-1/2 cursor-pointer justify-items-center gap-1 rounded-2xl border-2 bg-white/95 px-2 py-2.5 shadow-lg transition-colors hover:shadow-xl ${meta.border}`}
              style={{ left: CARD_XS[index], top: CARD_Y }}
              type="button"
              onClick={(event) => cycleAnswer(index, event.shiftKey ? -1 : 1)}
            >
              <check.Icon className="size-6 text-slate-600" strokeWidth={2.5} />
              <span className="min-h-8 text-center text-xs leading-tight font-bold">
                {check.label}
              </span>
              <span
                key={value}
                className={`value-pop text-sm leading-none font-extrabold ${meta.text}`}
              >
                <StatusIcon className="inline size-3.5 align-middle" strokeWidth={3} /> {words.word}
              </span>
              <ValueDots className="mt-1" value={value} />
            </button>
          );
        })}
        {[1, 2, 3].map((index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-300 bg-white px-1.5 py-1 text-2xs leading-none font-extrabold text-slate-500"
            style={{
              left: ((CARD_XS[index - 1] ?? 0) + (CARD_XS[index] ?? 0)) / 2,
              top: CARD_Y,
            }}
          >
            {connector}
          </span>
        ))}
        <OperatorBadge operator={scenario.operator} x={HUB_X} y={HUB_Y} />
        <VerdictCard
          className="absolute -translate-x-1/2 -translate-y-1/2"
          Icon={resultWords.Icon}
          style={{ left: HUB_X, top: VERDICT_Y }}
          title={<span className="whitespace-nowrap">{scenario.verdicts[result]}</span>}
          value={result}
        />
      </DiagramCanvas>
    </WidgetShell>
  );
}
