"use client";

/**
 * Recursive renderer for a @factbag/core `Judgment`: conclusion at the root,
 * supports underneath, evidence (with provenance) at the leaves.
 */
import { useState, type JSX } from "react";
import { Check, Globe2, X } from "lucide-react";

import type { Atom } from "@factbag/core/dsl";
import type { Judgment } from "@factbag/core/query";

import { assertNever } from "../lib/assert-never";
import { formatAtom, formatBindings, formatGoal, formatRule } from "./format";
import { supportsOf, type AnySupport } from "./judgment";
import { VERDICT } from "../theme";

export function ProofTree(props: {
  readonly judgment: Judgment;
  /** Fired by the value pill of leaf atoms — atoms settled by evidence or silence, not by a rule. */
  readonly onAtomClick?: (atom: Atom) => void;
}): JSX.Element {
  return (
    <JudgmentNode
      id={formatGoal(props.judgment.goal)}
      judgment={props.judgment}
      onAtomClick={props.onAtomClick}
    />
  );
}

type SupportRole = "against" | "for" | "inconclusive" | undefined;

type LabeledSupport = {
  readonly role: SupportRole;
  readonly support: AnySupport;
};

function JudgmentNode(props: {
  readonly id: string;
  readonly judgment: Judgment;
  readonly onAtomClick?: ((atom: Atom) => void) | undefined;
  readonly role?: SupportRole;
}): JSX.Element {
  const { judgment, onAtomClick } = props;
  const [folded, setFolded] = useState(false);
  const meta = VERDICT[judgment.value];
  const supports = displaySupports(judgment);
  const childCount = supports.reduce((total, entry) => total + countChildren(entry.support), 0);
  const hasChildren = childCount > 0;
  const leafAtom = leafAtomOf(judgment);
  const pillClass = `value-pop inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none font-extrabold text-white ${meta.pill}`;

  return (
    <div
      className={`rounded-2xl border-2 bg-white/95 px-4 py-3 shadow-md transition-colors ${meta.border}`}
      data-proof-id={props.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        {props.role === undefined ? null : (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-500">
            {props.role}
          </span>
        )}
        <span className="font-mono text-sm font-bold">{formatGoal(judgment.goal)}</span>
        <span className="text-sm text-slate-400">=</span>
        {leafAtom !== undefined && onAtomClick !== undefined ? (
          <button
            key={judgment.value}
            className={`${pillClass} cursor-pointer transition-shadow hover:ring-2 hover:ring-slate-300`}
            data-proof-click="atom"
            type="button"
            onClick={() => onAtomClick(leafAtom)}
          >
            {meta.symbol} {meta.label}
          </button>
        ) : (
          <span key={judgment.value} className={pillClass}>
            {meta.symbol} {meta.label}
          </span>
        )}
        {hasChildren ? (
          <button
            aria-expanded={!folded}
            className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-xs font-bold text-slate-400 transition-colors hover:text-slate-700"
            type="button"
            onClick={() => setFolded((current) => !current)}
          >
            <span aria-hidden="true">{folded ? "▸" : "▾"}</span>
            <span>because</span>
          </button>
        ) : null}
      </div>
      {folded ? null : (
        <div className="mt-2 space-y-2">
          {supports.map((entry) => {
            const segment = supportSegment(entry);
            return (
              <SupportBlock
                key={segment}
                id={`${props.id}/${segment}`}
                role={entry.role}
                support={entry.support}
                onAtomClick={onAtomClick}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The goal's atom, when it is settled by evidence or silence rather than a rule. */
function leafAtomOf(judgment: Judgment): Atom | undefined {
  if (judgment.goal.kind !== "atom") {
    return undefined;
  }
  if (supportsOf(judgment).some((support) => support.source === "rule")) {
    return undefined;
  }
  return judgment.goal.atom;
}

function displaySupports(judgment: Judgment): readonly LabeledSupport[] {
  if (judgment.value === "true") {
    return judgment.positive.map((support) => ({ role: undefined, support }));
  }
  if (judgment.value === "false") {
    return judgment.negative.map((support) => ({ role: undefined, support }));
  }
  if (judgment.value === "conflicted") {
    const positive = judgment.positive.map<LabeledSupport>((support) => ({
      role: "for",
      support,
    }));
    const negative = judgment.negative
      .filter((support) => !judgment.positive.includes(support))
      .map<LabeledSupport>((support) => ({ role: "against", support }));
    return [...positive, ...negative];
  }
  return (judgment.inconclusive ?? []).map((support) => ({
    role: "inconclusive",
    support,
  }));
}

/**
 * A support's identity within its judgment: role plus what it points at,
 * never the value it currently carries — stable across re-solves.
 */
function supportSegment(entry: LabeledSupport): string {
  const role = entry.role ?? "support";
  switch (entry.support.source) {
    case "closed-world-absence":
      return `${role}:absence`;
    case "evidence":
      return `${role}:evidence`;
    case "primitive":
      return `${role}:primitive`;
    case "rule":
      return `${role}:rule:${formatGoal(entry.support.body.goal)}`;
    case "subgoals":
      return `${role}:subgoals`;
    default:
      return assertNever(entry.support, "Unhandled support source");
  }
}

function countChildren(support: AnySupport): number {
  switch (support.source) {
    case "closed-world-absence":
      return 1;
    case "evidence":
      return support.literals.length;
    case "primitive":
      return 1;
    case "rule":
      return 1;
    case "subgoals":
      return support.judgments.length;
    default:
      return assertNever(support, "Unhandled support source");
  }
}

function SupportBlock(props: {
  readonly id: string;
  readonly onAtomClick?: ((atom: Atom) => void) | undefined;
  readonly role: SupportRole;
  readonly support: AnySupport;
}): JSX.Element {
  const { role, support } = props;

  switch (support.source) {
    case "evidence":
      return (
        <div className="flex flex-wrap items-start gap-2">
          <SupportLabel role={role} text="evidence" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            {support.literals.map((literal, index) => {
              const value = literal.sign === "+" ? "true" : "false";
              const Icon = literal.sign === "+" ? Check : X;

              return (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                >
                  <Icon className={`size-3.5 ${VERDICT[value].text}`} strokeWidth={3} />
                  <span className="font-mono text-xs font-bold">{formatAtom(literal.atom)}</span>
                  {literal.metadata?.source === undefined ? null : (
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-100">
                      {literal.metadata.source}
                    </span>
                  )}
                  {literal.metadata?.citation === undefined ? null : (
                    <span className="text-xs text-slate-600 italic">
                      &ldquo;{literal.metadata.citation}&rdquo;
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    case "closed-world-absence":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <SupportLabel role={role} text="world" />
          <span className="inline-flex items-center gap-1 text-xs leading-5 text-slate-600">
            <Globe2 className="size-3.5" strokeWidth={2.5} /> closed-world: nothing on file, so
            absence counts as false
          </span>
        </div>
      );
    case "rule":
      return (
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <SupportLabel role={role} text="rule" />
            <span className="font-mono text-xs leading-5 text-slate-600">
              {formatRule(support.rule)}
              {formatBindings(support.body.bindings)}
            </span>
          </div>
          <div className="mt-1.5 ml-2 border-l-2 border-slate-300 pl-5">
            <div className="relative">
              <span aria-hidden="true" className="absolute top-6 -left-5 h-0.5 w-5 bg-slate-300" />
              <JudgmentNode
                id={`${props.id}/${formatGoal(support.body.goal)}`}
                judgment={support.body}
                onAtomClick={props.onAtomClick}
              />
            </div>
          </div>
        </div>
      );
    case "subgoals":
      return (
        <div className="ml-2 space-y-2 border-l-2 border-slate-300 pl-5">
          {support.judgments.map((child) => {
            const childId = `${props.id}/${formatGoal(child.goal)}`;
            return (
              <div key={childId} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-6 -left-5 h-0.5 w-5 bg-slate-300"
                />
                <JudgmentNode
                  id={childId}
                  judgment={child}
                  role={role}
                  onAtomClick={props.onAtomClick}
                />
              </div>
            );
          })}
        </div>
      );
    case "primitive":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <SupportLabel role={role} text="primitive" />
          <span className="font-mono text-xs leading-5 text-slate-600">
            {"evaluation" in support ? support.evaluation.operation : "primitive evaluation"}
          </span>
        </div>
      );
    default:
      return assertNever(support, "Unhandled support source");
  }
}

function SupportLabel(props: { readonly role: SupportRole; readonly text: string }): JSX.Element {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-bold text-slate-400">
      {props.role === undefined ? null : (
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-500">{props.role}</span>
      )}
      <span>{props.text}:</span>
    </span>
  );
}
