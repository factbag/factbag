import type { JSX } from "react";

export type CodeTone = "add" | "comment" | "plain" | "remove";

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
  readonly title: string;
}): JSX.Element {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 shadow-inner">
      <p className="mb-2 font-mono text-2xs font-bold tracking-widest text-slate-400 uppercase">
        {props.title}
      </p>
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
