"use client";

import { createContext, useContext, type JSX, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { VALUES, type GoalValue, type Operator } from "./values";
import { VERDICT } from "../theme";

const ChromeContext = createContext<"card" | "plain">("card");

/** Hosts pick the widget framing: a standalone card (Storybook, the default)
 * or plain flow (docs prose, where the surrounding section already frames it). */
export function WidgetChrome(props: {
  readonly children: ReactNode;
  readonly variant: "card" | "plain";
}): JSX.Element {
  return <ChromeContext.Provider value={props.variant}>{props.children}</ChromeContext.Provider>;
}

/** The standard widget frame: soft gradient card with an optional eyebrow +
 * serif title, or — in plain chrome — just the title over unframed content.
 * Widgets that open with their own controls leave both out. */
export function WidgetShell(props: {
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly title?: string;
}): JSX.Element {
  const chrome = useContext(ChromeContext);

  if (chrome === "plain") {
    return (
      <section className="max-w-5xl font-sans text-slate-900">
        {props.title === undefined ? null : (
          <header className="mb-4">
            <h3 className="font-serif text-xl leading-tight font-bold text-balance">
              {props.title}
            </h3>
          </header>
        )}
        {props.children}
      </section>
    );
  }

  return (
    <section className="max-w-5xl rounded-3xl border border-slate-200 bg-linear-to-br from-amber-50 via-slate-50 to-indigo-50 p-7 font-sans text-slate-900 shadow-2xl shadow-slate-900/10">
      {props.eyebrow === undefined && props.title === undefined ? null : (
        <header className="mb-4">
          {props.eyebrow === undefined ? null : (
            <p className="mb-2 text-xs font-extrabold tracking-widest text-slate-500 uppercase">
              {props.eyebrow}
            </p>
          )}
          {props.title === undefined ? null : (
            <h2 className="font-serif text-2xl leading-tight font-bold text-balance sm:text-4xl">
              {props.title}
            </h2>
          )}
        </header>
      )}
      {props.children}
    </section>
  );
}

/** Boxed lead paragraph for the rule a widget demonstrates. */
export function RuleBox(props: { readonly children: ReactNode }): JSX.Element {
  return (
    <p className="mb-4 rounded-2xl border border-slate-200 bg-white/75 px-4 py-3 text-sm leading-6 text-slate-700">
      {props.children}
    </p>
  );
}

/** Four-stop indicator showing where a cycling value currently sits. */
export function ValueDots(props: {
  readonly className?: string;
  readonly value: GoalValue;
}): JSX.Element {
  return (
    <span className={`flex gap-1.5 ${props.className ?? ""}`}>
      {VALUES.map((candidate) => (
        <span
          key={candidate}
          className={`h-1.5 w-1.5 rounded-full transition-all ${
            candidate === props.value ? `scale-150 ${VERDICT[candidate].pill}` : "bg-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

/** Black AND / OR pill, absolutely positioned on a wire junction. */
export function OperatorBadge(props: {
  readonly operator: Operator;
  readonly x: number;
  readonly y: number;
}): JSX.Element {
  return (
    <span
      className="absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs leading-none font-extrabold tracking-wide whitespace-nowrap text-white uppercase shadow-md"
      style={{ left: props.x, top: props.y }}
      title={props.operator === "and" ? "AND — all must pass" : "OR — one is enough"}
    >
      {props.operator === "and" ? "AND" : "OR"}
    </span>
  );
}

/** Tab-style toggle pill for scenario and mode pickers. */
export function ChoicePill(props: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly selected: boolean;
}): JSX.Element {
  return (
    <button
      aria-pressed={props.selected}
      className={`cursor-pointer rounded-full px-4 py-2 text-sm font-bold shadow-sm transition-colors ${
        props.selected
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white/80 text-slate-600 hover:bg-white"
      }`}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Result card: big popping icon plus a two-line label, bordered in the value color. */
export function VerdictCard(props: {
  readonly caption?: ReactNode;
  readonly className?: string;
  readonly Icon: LucideIcon;
  readonly style?: React.CSSProperties;
  readonly title: ReactNode;
  readonly value: GoalValue;
}): JSX.Element {
  const meta = VERDICT[props.value];

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 bg-white/95 px-5 py-3 shadow-lg transition-colors ${props.className ?? ""}`}
      style={{ borderColor: meta.color, ...props.style }}
    >
      <props.Icon
        key={props.value}
        className={`value-pop size-8 ${meta.text}`}
        strokeWidth={2.75}
      />
      <span className="grid text-left">
        <span className="text-sm font-extrabold">{props.title}</span>
        {props.caption === undefined ? null : (
          <span className="text-xs text-slate-500">{props.caption}</span>
        )}
      </span>
    </div>
  );
}
