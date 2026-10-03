"use client";

import type { JSX, ReactNode } from "react";

import type { GoalValue } from "./lib/values";

/**
 * A plumbing-support bot behind a counter, a customer in front with the
 * offending toilet, drawn in one ink. The base scene never changes; each fact
 * adds one element at a fixed spot, present when the fact holds or is
 * contested, absent when it fails or is unknown. The verdict is deliberately
 * not drawn: the scene shows the evidence, the verdict card the decision.
 */

const INK = "#1e293b";
const PAPER = "#ffffff";
const SHADE = "#e2e8f0";
const FAINT = "#94a3b8";

export type SceneKind = "escalate" | "review";

export function EverydayDecisionScene(props: {
  readonly kind: SceneKind;
  readonly values: readonly GoalValue[];
}): JSX.Element {
  const [first = "unknown", second = "unknown", third = "unknown", fourth = "unknown"] =
    props.values;
  const escalate = props.kind === "escalate";

  return (
    <svg
      aria-hidden="true"
      className="mx-auto mb-4 block w-full max-w-160"
      viewBox="0 0 640 260"
      fill="none"
      stroke={INK}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
    >
      <line x1={16} x2={624} y1={232} y2={232} stroke={FAINT} />

      {escalate ? null : <WallCalendar value={fourth} />}

      <Toilet fixed={escalate ? undefined : second} />
      <Customer mood={first} upsetIsYes={escalate} />
      <Bot stuck={escalate ? fourth : "false"} />

      {/* Counter, over the bot's body */}
      <rect x={248} y={148} width={228} height={84} rx={6} fill={SHADE} />
      <rect x={236} y={134} width={252} height={18} rx={8} fill={PAPER} />
      <circle cx={326} cy={140} r={7} fill={PAPER} />
      <circle cx={434} cy={140} r={7} fill={PAPER} />

      {/* What the customer said, one bubble per fact */}
      {escalate ? (
        <Fact value={second}>
          <Bubble x={72} y={20} tail="right">
            <Siren />
          </Bubble>
        </Fact>
      ) : null}
      <Fact value={third}>
        <Bubble x={196} y={38} tail="left">
          {escalate ? <Silhouette /> : <Repeat />}
        </Bubble>
      </Fact>
    </svg>
  );
}

/** Draws `children` when the fact holds or is contested, `whenFalse` otherwise. */
function Fact(props: {
  readonly children?: ReactNode;
  readonly value: GoalValue;
  readonly whenFalse?: ReactNode;
}): JSX.Element {
  const present = props.value === "true" || props.value === "conflicted";

  return <g>{present ? props.children : props.whenFalse}</g>;
}

/** Side profile: tank at the back, seat, bowl, pedestal. The leak is drawn until it is fixed. */
function Toilet(props: { readonly fixed: GoalValue | undefined }): JSX.Element {
  return (
    <g>
      <rect x={28} y={122} width={30} height={68} rx={4} fill={PAPER} />
      <rect x={22} y={114} width={42} height={10} rx={4} fill={PAPER} />
      <path d="M 56 196 H 116 Q 112 220 96 226 H 76 Q 60 220 56 196 Z" fill={PAPER} />
      <rect x={52} y={186} width={68} height={12} rx={5} fill={PAPER} />
      <rect x={70} y={224} width={32} height={8} rx={3} fill={PAPER} />
      {props.fixed === undefined ? null : <Fact value={props.fixed} whenFalse={<Leak />} />}
    </g>
  );
}

/** A fountain out of the bowl. */
function Leak(): JSX.Element {
  return (
    <g>
      <path d="M 86 186 q 0 -44 0 -68" />
      <path d="M 86 186 q -4 -34 -28 -50" />
      <path d="M 86 186 q 4 -34 28 -50" />
      <circle cx={86} cy={110} r={3.5} fill={PAPER} />
      <circle cx={54} cy={128} r={3.5} fill={PAPER} />
      <circle cx={118} cy={128} r={3.5} fill={PAPER} />
      <circle cx={70} cy={148} r={2.5} fill={PAPER} />
      <circle cx={102} cy={148} r={2.5} fill={PAPER} />
    </g>
  );
}

/** The face carries the mood fact: cross with knitted brows, pleased, or neutral. */
function Customer(props: { readonly mood: GoalValue; readonly upsetIsYes: boolean }): JSX.Element {
  const present = props.mood === "true" || props.mood === "conflicted";
  return (
    <g>
      <path d="M 132 232 V 160 a 28 28 0 0 1 28 -28 h 0 a 28 28 0 0 1 28 28 V 232 Z" fill={PAPER} />
      <circle cx={160} cy={96} r={32} fill={PAPER} />
      <circle cx={148} cy={92} r={3.5} fill={INK} stroke="none" />
      <circle cx={172} cy={92} r={3.5} fill={INK} stroke="none" />
      {present ? (
        props.upsetIsYes ? (
          <>
            <path d="M 142 78 l 10 4" />
            <path d="M 178 78 l -10 4" />
            <path d="M 150 112 Q 160 104 170 112" />
          </>
        ) : (
          <path d="M 149 106 Q 160 117 171 106" />
        )
      ) : (
        <line x1={150} x2={170} y1={109} y2={109} />
      )}
    </g>
  );
}

function Bot(props: { readonly stuck: GoalValue }): JSX.Element {
  return (
    <g>
      <line x1={380} x2={380} y1={44} y2={32} />
      <circle cx={380} cy={26} r={6} fill={PAPER} />
      <rect x={350} y={102} width={60} height={56} rx={16} fill={PAPER} />
      <path d="M 350 118 q -24 4 -24 22" />
      <path d="M 410 118 q 24 4 24 22" />
      <rect x={346} y={44} width={68} height={58} rx={18} fill={PAPER} />
      <rect x={356} y={54} width={48} height={38} rx={10} fill={SHADE} stroke="none" />
      <circle cx={370} cy={70} r={4} fill={INK} stroke="none" />
      <circle cx={390} cy={70} r={4} fill={INK} stroke="none" />
      <path d="M 372 80 Q 380 87 388 80" />
      <Fact value={props.stuck}>
        {/* Out of its depth: a question mark over its head. */}
        <path d="M 420 36 a 9 9 0 1 1 12 8 q -3 2 -3 7" />
        <circle cx={429} cy={59} r={2.2} fill={INK} stroke="none" />
      </Fact>
    </g>
  );
}

/** A 56×48 speech bubble at (x, y); `tail` points it down-left at the customer. */
function Bubble(props: {
  readonly children: ReactNode;
  readonly tail?: "left" | "right";
  readonly x: number;
  readonly y: number;
}): JSX.Element {
  const tail =
    props.tail === "left"
      ? "h -14 l -12 12 v -12 h -6"
      : props.tail === "right"
        ? "h -6 v 12 l -12 -12 h -14"
        : "h -32";

  return (
    <g transform={`translate(${props.x} ${props.y})`}>
      <path
        d={`M 12 0 h 32 a 12 12 0 0 1 12 12 v 24 a 12 12 0 0 1 -12 12 ${tail} a 12 12 0 0 1 -12 -12 v -24 a 12 12 0 0 1 12 -12 z`}
        fill={PAPER}
      />
      <g transform="translate(28 24)">{props.children}</g>
    </g>
  );
}

/** "It's an emergency": a flashing siren light. */
function Siren(): JSX.Element {
  return (
    <g>
      <rect x={-13} y={8} width={26} height={7} rx={3} fill={PAPER} />
      <path d="M -11 8 a 11 11 0 0 1 22 0 z" fill={SHADE} />
      <g className="siren-flash">
        <line x1={0} x2={0} y1={-8} y2={-17} />
        <line x1={-12} x2={-18} y1={-5} y2={-11} />
        <line x1={12} x2={18} y1={-5} y2={-11} />
        <line x1={-17} x2={-25} y1={3} y2={2} />
        <line x1={17} x2={25} y1={3} y2={2} />
      </g>
    </g>
  );
}

/** A person, asked for by name. */
function Silhouette(): JSX.Element {
  return (
    <g fill={INK} stroke="none">
      <circle cy={-8} r={7} />
      <path d="M -14 16 a 14 14 0 0 1 28 0 z" />
    </g>
  );
}

/** "I'd use you again": two arrows chasing each other. */
function Repeat(): JSX.Element {
  return (
    <g>
      <path d="M -11 -4 a 12 12 0 0 1 21 -5" />
      <path d="M 10 -14 v 6 h -6" />
      <path d="M 11 4 a 12 12 0 0 1 -21 5" />
      <path d="M -10 14 v -6 h 6" />
    </g>
  );
}

function WallCalendar(props: { readonly value: GoalValue }): JSX.Element {
  return (
    <g>
      <rect x={540} y={64} width={60} height={60} rx={6} fill={PAPER} />
      <line x1={540} x2={600} y1={80} y2={80} />
      <line x1={554} x2={554} y1={56} y2={70} />
      <line x1={586} x2={586} y1={56} y2={70} />
      <Fact value={props.value}>
        <path d="M 560 92 l 20 20 m 0 -20 l -20 20" />
      </Fact>
    </g>
  );
}
