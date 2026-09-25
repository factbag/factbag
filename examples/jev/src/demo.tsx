/**
 * End-to-end demo against the live Jev API: a question encoded as rules, a knowledge
 * base the model reads documents into, and a proof tree whose every leaf points at the
 * document that supports it. `main.tsx` runs it.
 */
import { Box, Text, useApp } from "ink";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type {
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Var } from "@factbag/core/dsl";
import type { GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import { explainJudgment } from "@factbag/core/explain";
import type { EvidenceReason, Explanation } from "@factbag/core/explain";
import type { AnyRule, KnowledgeBase, Literal } from "@factbag/core/kb";
import { query } from "@factbag/core/query";
import { guard } from "@factbag/guards";
import { classifier } from "@factbag/jev/classifier";
import { resolver } from "@factbag/jev/resolve";
import type { Scenario } from "@factbag/scenarios";
import createHaystackScenario from "@factbag/scenarios/haystack";
import createJ1Scenario from "@factbag/scenarios/j1";
import { pool } from "./pool";
import createOfacScenario from "@factbag/scenarios/ofac";

type Corpus = Scenario["corpus"];
type Run = ReturnType<typeof classifier>;
type Job = Run extends Iterable<infer J> ? J : never;
type Assessment = Awaited<ReturnType<Job["execute"]>>;
type ResolutionRun = ReturnType<typeof resolver>;
type ResolutionJob = ResolutionRun extends Iterable<infer J> ? J : never;
type Resolution = Awaited<ReturnType<ResolutionJob["execute"]>>;
type ResolutionRow =
  | { readonly state: "waiting" | "reading"; readonly job: ResolutionJob }
  | { readonly state: "failed"; readonly job: ResolutionJob; readonly error: string }
  | {
      readonly state: "done";
      readonly job: ResolutionJob;
      readonly result: Resolution;
    };
type Row =
  | { readonly state: "waiting"; readonly job: Job }
  | { readonly state: "reading"; readonly job: Job }
  | { readonly state: "done"; readonly job: Job; readonly result: Assessment }
  | { readonly state: "failed"; readonly job: Job; readonly error: string };

/** What the demo needs to tell one scenario's story. */
export type Showcase = Readonly<{
  scenario: Scenario;
  title: string;
  subtitle: string;
  label: string;
  question: string;
  ask: GroundAtom;
}>;

const j1Cases = [
  "positive",
  "negative",
  "contradictory",
  "contradictory-document",
  "neutral",
] as const;

// Never wider than the terminal; Ink lays out non-TTY output at 80 columns or the detected size.
export const width = Math.min(process.stdout.columns > 0 ? process.stdout.columns : 80, 104);
// The caller chooses concurrency; jobs themselves contain no scheduler.
const concurrency = 32;

export function showcase([name = "j1", caseArgument]: readonly string[]): Showcase {
  if (name === "haystack") {
    const scenario = createHaystackScenario();
    const { transaction } = scenario.entities;
    return {
      scenario,
      title: "Sanctions screening · haystack",
      subtitle: `Payment ${transaction.id} · ${scenario.corpus.documents().length} documents of mostly unrelated paperwork`,
      label: "haystack",
      question: `Is payment ${transaction.id} prohibited? The same question as the OFAC case, with the evidence buried in unrelated registers, minutes, reports and payment advices.`,
      ask: scenario.predicates.prohibited({ transaction }),
    };
  }
  if (name === "ofac") {
    const scenario = createOfacScenario();
    const { transaction } = scenario.entities;
    return {
      scenario,
      title: "Sanctions screening",
      subtitle: `Payment ${transaction.id} · abstract sanctions benchmark`,
      label: "ofac",
      question: `Is payment ${transaction.id} prohibited? It is if a blocked party is involved and the transaction is in a sanctioned industry. A party is blocked if it is sanctioned, or majority-owned or controlled by a blocked party.`,
      ask: scenario.predicates.prohibited({ transaction }),
    };
  }
  if (name !== "j1") {
    throw new Error(`Unknown scenario "${name}". Choose j1, ofac or haystack.`);
  }
  const caseName = j1Cases.find((candidate) => candidate === (caseArgument ?? "contradictory"));
  if (caseName === undefined) {
    throw new Error(`Unknown J-1 case "${caseArgument}". Choose one of: ${j1Cases.join(", ")}`);
  }
  const scenario = createJ1Scenario(caseName);
  const { applicant } = scenario;
  return {
    scenario,
    title: "J-1 eligibility",
    subtitle: `${applicant.name} · 22 CFR §62.20(d)(1)`,
    label: `j1 · ${caseName}`,
    question: `Is ${applicant.name} barred from the J-1 professor and research scholar category? Under 22 CFR §62.20(d)(1), a participant must not be a candidate for a tenure-track position at the host institution.`,
    ask: scenario.predicates.disqualified({ person: applicant }),
  };
}

export function Demo({
  showcase: { scenario, title, subtitle, label, question, ask },
  onFinished,
}: {
  showcase: Showcase;
  onFinished?: () => void;
}): ReactElement {
  const { exit } = useApp();
  const { kb, corpus, targets } = scenario;
  // One metered client for both stages, so the summary can report the whole run.
  const [meter] = useState(createMeter);
  // The model may assert or deny exactly the predicates the scenario's documents are labeled for.
  const [run] = useState(() => {
    const writable = [...new Set(targets.map(({ predicate }) => predicate))];
    return classifier(corpus, guard(kb).permit("*", ...writable), { client: meter.client });
  });
  // Enumerating jobs makes no remote calls; each request happens in execute().
  const [rows, setRows] = useState<readonly Row[]>(() =>
    [...run].map((job) => ({ state: "waiting", job })),
  );
  const finished = rows.every(({ state }) => state === "done" || state === "failed");

  useEffect(() => {
    let cancelled = false;
    const update = (index: number, row: Row): void => {
      if (!cancelled) {
        setRows((current) => current.map((existing, at) => (at === index ? row : existing)));
      }
    };
    void pool(rows, concurrency, async ({ job }, index) => {
      update(index, { state: "reading", job });
      try {
        update(index, { state: "done", job, result: await job.execute() });
      } catch (error) {
        process.exitCode = 1;
        update(index, {
          state: "failed",
          job,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once; rows are read from the initial state.
  }, []);

  // Contradictions can only be found once every document has been read.
  const [resolution, setResolution] = useState<
    { run: ResolutionRun; rows: readonly ResolutionRow[] } | undefined
  >(undefined);
  useEffect(() => {
    if (!finished || resolution !== undefined) {
      return;
    }
    const resolutionRun = resolver(corpus, run.kb, { client: meter.client });
    const jobs = [...resolutionRun];
    setResolution({
      run: resolutionRun,
      rows: jobs.map((job) => ({ state: "waiting", job })),
    });
    const update = (index: number, row: ResolutionRow): void => {
      setResolution((current) =>
        current === undefined ? current : { ...current, rows: replace(current.rows, index, row) },
      );
    };
    void pool(jobs, concurrency, async (job, index) => {
      update(index, { state: "reading", job });
      try {
        update(index, { state: "done", job, result: await job.execute() });
      } catch (error) {
        process.exitCode = 1;
        update(index, {
          state: "failed",
          job,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }, [finished, resolution, corpus, run, meter]);

  const contradictions = resolution?.rows ?? [];
  const resolved =
    resolution?.rows.every(({ state }) => state === "done" || state === "failed") ?? false;
  const resolvedKb = resolved ? resolution?.run.kb : undefined;
  useEffect(() => {
    if (resolved) {
      (onFinished ?? exit)();
    }
  }, [resolved, exit, onFinished]);

  // Judged on the resolved KB once contradictions have been settled.
  const answers = resolvedKb ?? run.kb;
  const checks = scenario.expected.map(({ atom, value }) => ({
    atom,
    value,
    actual: query(answers, atom).value,
  }));
  if (resolved && checks.some(({ value, actual }) => value !== actual)) {
    process.exitCode = 1;
  }
  const facts = kb.literals().length;

  return (
    <Box flexDirection="column" width={width}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Box flexDirection="column">
          <Text bold>{title}</Text>
          <Text dimColor>{subtitle}</Text>
        </Box>
        <Text color="cyan">{label}</Text>
      </Box>

      <Act number={1} title="The question">
        <Text>{question}</Text>
        <Box marginTop={1} gap={2}>
          <Text bold>{formatAtom(ask)}</Text>
          <Value value={query(kb, ask).value} />
        </Box>
        <Text dimColor>
          {facts === 0
            ? "With no facts known yet, the rules alone cannot decide."
            : `With only ${facts} stipulated ${facts === 1 ? "fact" : "facts"}, the rules alone cannot decide.`}
        </Text>
      </Act>

      {/* TEMPORARY — The answer key belongs to the eval; drop this act once it exists. */}
      <Act number={2} title="The expected answer" detail="from the scenario's answer key">
        {scenario.expected.map(({ atom, value }) => (
          <Box key={formatAtom(atom)}>
            <Box
              width={Math.max(...scenario.expected.map((item) => formatAtom(item.atom).length)) + 2}
            >
              <Text bold>{formatAtom(atom)}</Text>
            </Box>
            <Value value={value} />
          </Box>
        ))}
      </Act>

      <Act
        number={3}
        title="The knowledge base"
        detail="everything the solver knows, before reading"
      >
        <KnowledgeBaseView kb={kb} />
      </Act>

      <Act
        number={4}
        title="Reading"
        detail={`${rows.filter(({ state }) => state === "done").length}/${rows.length} requests · ${concurrency} at a time`}
      >
        <ReadingTable rows={rows} corpus={corpus} />
        <Box marginTop={1} gap={2}>
          <Text dimColor>distribution</Text>
          <Text color="green">█ assert</Text>
          <Text color="red">█ deny</Text>
          <Text dimColor>░ irrelevant</Text>
        </Box>
      </Act>

      {finished ? (
        <Act number={5} title="The answer">
          <ProofNode
            explanation={explainJudgment(query(run.kb, ask))}
            corpus={corpus}
            kb={run.kb}
          />
        </Act>
      ) : null}

      {contradictions.length > 0 ? (
        <Act
          number={6}
          title="Resolving contradictions"
          detail={`${contradictions.filter(({ state }) => state === "done").length}/${contradictions.length} contradictions · ${concurrency} at a time`}
        >
          <ResolutionView rows={contradictions} corpus={corpus} />
        </Act>
      ) : null}

      {resolvedKb !== undefined && contradictions.length > 0 ? (
        <Act number={7} title="The answer, after resolution">
          <ProofNode
            explanation={explainJudgment(query(resolvedKb, ask))}
            corpus={corpus}
            kb={resolvedKb}
          />
        </Act>
      ) : null}

      {resolved ? <AnswerKey checks={checks} /> : null}

      {resolved ? <Summary meter={meter} /> : null}
    </Box>
  );
}

/** One block per contradiction: the fact, then each passage the model judged. */
function ResolutionView({
  rows,
  corpus,
}: {
  rows: readonly ResolutionRow[];
  corpus: Corpus;
}): ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      {rows.map((row) => (
        <Box key={formatAtom(row.job.atom)} flexDirection="column">
          <Box justifyContent="space-between" gap={2}>
            <Text bold wrap="truncate-end">
              {formatAtom(row.job.atom)}
            </Text>
            <Box flexShrink={0}>
              {row.state === "done" ? (
                <Text dimColor>
                  {row.result.retracted.length} of {row.job.passages.length} retracted
                </Text>
              ) : row.state === "failed" ? (
                <Text color="red">✗ {row.error}</Text>
              ) : (
                <Text color="cyan">
                  <Spinner /> judging {row.job.passages.length} passages…
                </Text>
              )}
            </Box>
          </Box>
          {row.state === "done"
            ? row.result.judgments.map(({ passage, standing, answer, retracted }) => (
                <Box key={passage.id} gap={2} paddingLeft={2}>
                  <Box flexGrow={1} flexShrink={1} flexBasis={0}>
                    <Text wrap="truncate-end">
                      {corpus.resolve(passage.id).document.documentId}
                    </Text>
                  </Box>
                  <Box width={8} flexShrink={0}>
                    <Text color={standing === "RETRACT" ? "red" : "green"} bold>
                      {standing}
                    </Text>
                  </Box>
                  <Box flexShrink={0}>
                    <Text>{answer.probabilities.RETRACT.toFixed(2)}</Text>
                  </Box>
                  <Box width={20} flexShrink={0}>
                    {retracted.length === 0 ? (
                      <Text dimColor>evidence kept</Text>
                    ) : (
                      <Text color="red" wrap="truncate-end">
                        {retracted.map(({ sign }) => (sign === "+" ? "+" : "−")).join(" ")} evidence
                        retracted
                      </Text>
                    )}
                  </Box>
                </Box>
              ))
            : null}
        </Box>
      ))}
    </Box>
  );
}

function Act({
  number,
  title,
  detail,
  children,
}: {
  number: number;
  title: string;
  detail?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderDimColor paddingX={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          {number} <Text color="white">{title}</Text>
        </Text>
        {detail === undefined ? null : <Text dimColor>{detail}</Text>}
      </Box>
      {children}
    </Box>
  );
}

function KnowledgeBaseView({ kb }: { kb: KnowledgeBase }): ReactElement {
  const entities = kb.entities.all();
  const facts = kb.literals();
  return (
    <Box flexDirection="column" gap={1}>
      <Field label="Entities" count={entities.length}>
        {entities.map((entity) => (
          <Box key={entity.id} gap={2}>
            <Text color="magenta">{entity.constructor.name}</Text>
            <Text bold>{entity.id}</Text>
            <Text dimColor>
              {Object.entries(entity)
                .filter(([key]) => key !== "id")
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join("  ")}
            </Text>
          </Box>
        ))}
      </Field>
      <Field label="Predicates" count={kb.predicates().length}>
        {kb.predicates().map((predicate) => (
          <Box key={predicate.name} flexDirection="column">
            <Text bold>{signature(predicate)}</Text>
            {typeof predicate.metadata?.description === "string" ? (
              <Box paddingLeft={2}>
                <Text dimColor>{predicate.metadata.description}</Text>
              </Box>
            ) : null}
          </Box>
        ))}
      </Field>
      <Field label="Rules" count={kb.rules().length}>
        {kb.rules().map((rule) => (
          <Text key={formatRule(rule)} color="cyan">
            {formatRule(rule)}
          </Text>
        ))}
      </Field>
      <Field label="Facts" count={facts.length}>
        {facts.length === 0 ? <Text dimColor>none yet</Text> : null}
        {facts.map((literal) => (
          <Text key={formatLiteral(literal)}>{formatLiteral(literal)}</Text>
        ))}
      </Field>
    </Box>
  );
}

function Field({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}): ReactElement {
  return (
    <Box>
      <Box width={14} flexShrink={0}>
        <Text color="cyan">
          {label} <Text dimColor>{count}</Text>
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
}

/** One block per document: its status, then the candidates where the model saw evidence. */
function ReadingTable({ rows, corpus }: { rows: readonly Row[]; corpus: Corpus }): ReactElement {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const group = groups.get(row.job.source) ?? [];
    group.push(row);
    groups.set(row.job.source, group);
  }
  return (
    <Box flexDirection="column" gap={1}>
      {[...groups].map(([source, group]) => (
        <DocumentBlock key={source} source={source} rows={group} corpus={corpus} />
      ))}
    </Box>
  );
}

function DocumentBlock({
  source,
  rows,
  corpus,
}: {
  source: string;
  rows: readonly Row[];
  corpus: Corpus;
}): ReactElement {
  const { document } = corpus.resolve(source);
  const done = rows.filter(({ state }) => state === "done").length;
  const failures = rows.flatMap((row) => (row.state === "failed" ? [row.error] : []));
  const assessments = rows.flatMap((row) => (row.state === "done" ? row.result.assessments : []));
  const notable = assessments.filter(
    ({ answer, literals }) =>
      literals.length > 0 ||
      Math.max(answer.probabilities.ASSERT, answer.probabilities.DENY) >= 0.1,
  );
  const quiet = assessments.length - notable.length;
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" gap={2}>
        <Text wrap="truncate-end">
          <Text bold>{document.documentId}</Text> <Text dimColor>{describe(document.text)}</Text>
        </Text>
        <Box flexShrink={0}>
          {rows.some(({ state }) => state === "reading") ? (
            <Text color="cyan">
              <Spinner /> {done}/{rows.length}
            </Text>
          ) : (
            <Text dimColor>{done === rows.length ? "✓" : `${done}/${rows.length}`}</Text>
          )}
        </Box>
      </Box>
      {failures.map((error) => (
        <Text key={error} color="red">
          {"  "}✗ {error}
        </Text>
      ))}
      {notable.map(({ optionId, atom, answer, literals }) => (
        <Box key={`${atom.predicate.name}/${optionId}`} gap={2} paddingLeft={2}>
          <Box flexGrow={1} flexShrink={1} flexBasis={0}>
            <Text wrap="truncate-end">{formatAtom(atom)}</Text>
          </Box>
          <Box width={10} flexShrink={0}>
            <Text color={choiceColor(answer.choice)} bold>
              {answer.choice}
            </Text>
          </Box>
          <Box flexShrink={0}>
            <Text>
              <Text color="green">{"█".repeat(cells(answer.probabilities.ASSERT))}</Text>
              <Text color="red">{"█".repeat(cells(answer.probabilities.DENY))}</Text>
              <Text dimColor>
                {"░".repeat(
                  Math.max(
                    0,
                    10 - cells(answer.probabilities.ASSERT) - cells(answer.probabilities.DENY),
                  ),
                )}
              </Text>
            </Text>
          </Box>
          <Box flexShrink={0}>
            <Text>{answer.probabilities[answer.choice].toFixed(2)}</Text>
          </Box>
          <Box width={11} flexShrink={0}>
            {literals.length === 0 ? (
              <Text dimColor>not written</Text>
            ) : (
              <Text>
                {literals.map((literal) => (
                  <Text key={literal.sign} color={literal.sign === "+" ? "green" : "red"}>
                    {literal.sign === "+" ? "+ written" : "− written"}
                  </Text>
                ))}
              </Text>
            )}
          </Box>
        </Box>
      ))}
      {quiet > 0 ? (
        <Box paddingLeft={2}>
          <Text dimColor>
            {quiet} {notable.length > 0 ? "other " : ""}
            {quiet === 1 ? "candidate" : "candidates"} irrelevant
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function Spinner(): ReactElement {
  const frames = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);
  return <Text>{frames[frame]}</Text>;
}

/** One node of the solver's proof: its claim, then the rule or evidence that supports it. */
function ProofNode({
  explanation,
  corpus,
  kb,
}: {
  explanation: Explanation;
  corpus: Corpus;
  kb: KnowledgeBase;
}): ReactElement {
  const { atom, value } = splitClaim(explanation.claim);
  const given = "given" in explanation ? explanation.given : [];
  const because = typeof explanation.because === "string" ? explanation.because : undefined;
  const [rule, bindings] = because?.split(", with ") ?? [];
  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Text bold>{atom}</Text>
        <Value value={value} />
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderTop={false}
        borderRight={false}
        borderBottom={false}
        borderDimColor
        paddingLeft={1}
      >
        {given.length > 0 && rule !== undefined ? (
          <Box flexDirection="column">
            <Text>
              <Text dimColor>by rule </Text>
              <Text color="cyan">{rule}</Text>
            </Text>
            {bindings === undefined ? null : <Text dimColor>with {bindings}</Text>}
          </Box>
        ) : null}
        {given.length === 0 && because !== undefined ? <Text dimColor>{because}</Text> : null}
        {evidenceReasons(explanation).map((reason) => (
          <EvidenceLeaf
            key={`${reason.source}${reason.claim}`}
            reason={reason}
            corpus={corpus}
            kb={kb}
          />
        ))}
        {given.map((child) => (
          <ProofNode key={child.claim} explanation={child} corpus={corpus} kb={kb} />
        ))}
      </Box>
    </Box>
  );
}

function EvidenceLeaf({
  reason,
  corpus,
  kb,
}: {
  reason: EvidenceReason;
  corpus: Corpus;
  kb: KnowledgeBase;
}): ReactElement {
  const positive = reason.claim?.endsWith("= true") ?? false;
  const label = (
    <Text color={positive ? "green" : "red"} bold>
      {positive ? "+ asserted" : "− denied  "}
    </Text>
  );
  if (reason.source === undefined) {
    return (
      <Text>
        {label} <Text dimColor>stipulated in the knowledge base</Text>
      </Text>
    );
  }
  const source = reason.source;
  const { chunk, document } = corpus.resolve(source);
  const probability = kb
    .literals()
    .find((literal) => literal.metadata?.source === source && (literal.sign === "+") === positive)
    ?.metadata?.scores?.["probability"];
  return (
    <Box flexDirection="column" marginY={0}>
      <Box gap={2}>
        {label}
        <Text>{typeof probability === "number" ? probability.toFixed(2) : "    "}</Text>
        <Text>
          {document.documentId}{" "}
          <Text dimColor>
            · chars {chunk.range.start}–{chunk.range.end}
          </Text>
        </Text>
      </Box>
      <Box paddingLeft={12}>
        <Text dimColor>{describe(document.text)}</Text>
      </Box>
    </Box>
  );
}

/** Jev bills input tokens only, at $42 per billion (https://docs.typesafe.ai/models). */
const dollarsPerInputToken = 42 / 1_000_000_000;

type Meter = Readonly<{
  client: {
    systemOne: <Q extends Questions>(
      request: SystemOneRequest<Q>,
      options?: RequestOptions,
    ) => Promise<SystemOneResult<Q>>;
  };
  started: number;
  requests: () => number;
  inputTokens: () => number;
  elapsed: () => number;
}>;

/** Wrap the SDK to count what a run costs: requests, input tokens and wall-clock time. */
function createMeter(): Meter {
  // The SDK's 10s default is tight for requests carrying many questions or passages.
  const sdk = new TypeSafeClient({ timeout: 60_000 });
  let requests = 0;
  let inputTokens = 0;
  let finished = Date.now();
  const started = Date.now();
  return {
    client: {
      systemOne: async <Q extends Questions>(
        request: SystemOneRequest<Q>,
        options?: RequestOptions,
      ) => {
        const result = await sdk.systemOne(request, options);
        requests += 1;
        inputTokens += result.usage.input_tokens;
        finished = Date.now();
        return result;
      },
    },
    started,
    requests: () => requests,
    inputTokens: () => inputTokens,
    elapsed: () => finished - started,
  };
}

function Summary({ meter }: { meter: Meter }): ReactElement {
  const tokens = meter.inputTokens();
  const cost = tokens * dollarsPerInputToken;
  return (
    <Box marginTop={1} paddingX={2} gap={2}>
      <Text dimColor>{meter.requests()} requests</Text>
      <Text dimColor>·</Text>
      <Text dimColor>{tokens.toLocaleString("en")} input tokens</Text>
      <Text dimColor>·</Text>
      <Text dimColor>{(meter.elapsed() / 1000).toFixed(1)}s</Text>
      <Text dimColor>·</Text>
      <Text dimColor>~${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}</Text>
    </Box>
  );
}

function AnswerKey({
  checks,
}: {
  checks: readonly { atom: GroundAtom; value: string; actual: string }[];
}): ReactElement {
  const failures = checks.filter(({ value, actual }) => value !== actual);
  const passed = failures.length === 0;
  return (
    <Box flexDirection="column" marginTop={1} paddingX={2}>
      {/* TEMPORARY — The model's judgments belong to the eval; drop this check once it exists. */}
      <Text color={passed ? "green" : "red"}>
        {passed ? "✓" : "✗"} Answer key {checks.length - failures.length}/{checks.length}
      </Text>
      {failures.map(({ atom, value, actual }) => (
        <Text key={formatAtom(atom)} color="red">
          {"  "}
          {formatAtom(atom)}: expected {value}, got {actual}
        </Text>
      ))}
    </Box>
  );
}

function Value({ value }: { value: string }): ReactElement {
  return (
    <Text backgroundColor={valueColor(value)} color="black" bold>
      {` ${value.toUpperCase()} `}
    </Text>
  );
}

function evidenceReasons(item: Explanation): readonly EvidenceReason[] {
  const because = item.because;
  if (because === undefined || typeof because === "string") {
    return [];
  }
  const reasons = Array.isArray(because) ? because : [because];
  return reasons.filter(
    (reason): reason is EvidenceReason => typeof reason === "object" && !("given" in reason),
  );
}

function splitClaim(claim: string): { atom: string; value: string } {
  const at = claim.lastIndexOf(" = ");
  return { atom: claim.slice(0, at), value: claim.slice(at + 3) };
}

/** A one-line description of a document: an email's subject, sender and date, or its first lines. */
function describe(text: string): string {
  const subject = /^Subject: (.+)$/mu.exec(text)?.[1];
  if (subject === undefined) {
    const heading = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .slice(0, 2)
      .join(" · ");
    return heading.length > 64 ? `${heading.slice(0, 63)}…` : heading;
  }
  const from = /^From: ([^<\n]+?)\s*(?:<|$)/mu.exec(text)?.[1];
  const date = /^Date: ([A-Z][a-z]+ \d+)/mu.exec(text)?.[1];
  return [`"${subject}"`, from, date].filter((part) => part !== undefined).join(" · ");
}

function signature(predicate: PredicateDeclaration): string {
  const params = predicate.paramNames.map((name) => `${name}: ${typeName(predicate.params[name])}`);
  return `${predicate.name}(${params.join(", ")})`;
}

function formatRule(rule: AnyRule): string {
  return `${formatTerm(rule.head)} ${rule.kind} ${formatTerm(rule.body)}`;
}

/** Format a rule's head or body: literals, atoms with variables, and formulas. */
function formatTerm(value: unknown): string {
  if (value instanceof Var) {
    return String(value.name);
  }
  if (typeof value !== "object" || value === null) {
    return String(value);
  }
  if ("sign" in value && "atom" in value) {
    return value.sign === "-" ? `not(${formatTerm(value.atom)})` : formatTerm(value.atom);
  }
  if ("predicate" in value && "fields" in value) {
    const name =
      typeof value.predicate === "function" && "name" in value.predicate
        ? value.predicate.name
        : "?";
    const fields =
      typeof value.fields === "object" && value.fields !== null ? Object.values(value.fields) : [];
    return `${name}(${fields.map(formatTerm).join(", ")})`;
  }
  if ("kind" in value && "args" in value && Array.isArray(value.args)) {
    return `${String(value.kind)}(${value.args.map(formatTerm).join(", ")})`;
  }
  return "id" in value ? String(value.id) : JSON.stringify(value);
}

function formatLiteral(literal: Literal): string {
  return `${literal.sign === "+" ? "+" : "−"} ${formatAtom(literal.atom)}`;
}

function formatAtom(atom: GroundAtom): string {
  return formatTerm(atom);
}

function typeName(type: unknown): string {
  if (typeof type === "function") {
    return type.name;
  }
  return typeof type === "object" && type !== null && "values" in type && Array.isArray(type.values)
    ? type.values.join(" | ")
    : "unknown";
}

function cells(probability: number): number {
  return Math.round(probability * 10);
}

function choiceColor(choice: string): string {
  return choice === "ASSERT" ? "green" : choice === "DENY" ? "red" : "gray";
}

function valueColor(value: string): string {
  return value === "true"
    ? "green"
    : value === "false"
      ? "red"
      : value === "conflicted"
        ? "yellow"
        : "gray";
}

function replace<T>(rows: readonly T[], index: number, row: T): readonly T[] {
  return rows.map((existing, at) => (at === index ? row : existing));
}
