import type { JSX } from "react";

import type { Explanation } from "@factbag/core/explain";

type CodeTone = "add" | "comment" | "plain" | "remove";

export type CodeLine = {
  readonly text: string;
  readonly tone: CodeTone;
};

const TONE_CLASS: Record<CodeTone, string> = {
  add: "text-positive",
  comment: "text-slate-500 italic",
  plain: "text-slate-200",
  remove: "text-negative",
};

export function CodeBlock(props: {
  readonly lines: readonly CodeLine[];
  readonly title?: string;
}): JSX.Element {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 shadow-inner">
      {props.title === undefined ? null : (
        <p className="mb-2 font-mono text-2xs font-bold tracking-widest text-slate-400 uppercase">
          {props.title}
        </p>
      )}
      <pre className="font-mono text-xs leading-5">
        {props.lines.map((line, index) => (
          <div key={index} className={TONE_CLASS[line.tone]}>
            {line.text === "" ? " " : line.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

/** A solver explanation as pretty-printed JSON, with verdict lines tinted. */
export function jsonLines(explanation: Explanation): readonly CodeLine[] {
  return JSON.stringify(explanation, null, 2)
    .split("\n")
    .map((text) => ({ text, tone: toneForLine(text) }));
}

function toneForLine(text: string): CodeTone {
  if (text.includes('"because"') && !text.includes("=")) {
    return "comment";
  }
  if (text.includes("= true")) {
    return "add";
  }
  if (text.includes("= false")) {
    return "remove";
  }

  return "plain";
}
