/**
 * Settle rule-derived conflicts by rereading the extracted facts behind them.
 *
 * The passage resolver (`@factbag/jev/resolve`) settles an atom that carries evidence of
 * both signs, passage against passage. This module settles a different kind of conflict:
 * facts that each stand alone but cannot all hold together, which only the rules can tell.
 * The consumer names the conflict as an ordinary derived predicate, a *violation*, whose
 * rules say which stated facts are incompatible; the solver derives its ground atoms, and
 * the proof of each one leads back to the extracted literals it rests on. Those literals,
 * and only those, are read again against the passage they came from, one by one, and the
 * ones the rereading no longer supports are retracted. Everything else from the same
 * passage stays, with its metadata, and the rules are then consulted again.
 *
 * Nothing here knows any domain: which facts exclude one another is the consumer's rule,
 * and the model is asked the classifier's own question about each fact, never which one
 * to drop. A fact the rereading confirms stays, so a conflict can remain open; a run makes
 * at most `maxRounds` passes and stops when a pass retracts nothing.
 *
 * @packageDocumentation
 */
import type { AnyAtom, Atom, GroundAtom, PredicateDeclaration } from "@factbag/core/dsl";
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import { queryAll } from "@factbag/core/query";
import type { Judgment, QueryJudgment } from "@factbag/core/query";
import type { Chunk, Corpus, Metadata } from "@factbag/corpus";
import { jevRechecker } from "./client";
import type { RecheckClient } from "./client";
import { admissionPolicy } from "./jobs";
import type { AdmissionPolicy } from "./jobs";
import { encodeValue } from "./tools";
import type { CandidateValue } from "./tools";
import type { Candidate, EvidenceChoice, Standing } from "./types";

export type {
  ClassificationQuestions,
  ClassifierClient,
  RecheckClient,
  RecheckQuestions,
} from "./client";
export type { AdmissionPolicy } from "./jobs";
export type { EvidenceChoice, Outcome, Standing } from "./types";

/**
 * Client, admission and bound supplied by the consumer.
 *
 * @beta
 */
export type RecheckConfig = {
  /** Defaults to `new TypeSafeClient()`, configured from `TYPESAFE_*` environment variables. */
  readonly client?: RecheckClient;
  /**
   * A literal stands when the rereading admits its sign under this policy, as the
   * classifier would have admitted it. Defaults to 0.4 and 0.
   */
  readonly admission?: AdmissionPolicy;
  /** Passes of derive, reread and retract before an open conflict is reported. Defaults to 2. */
  readonly maxRounds?: number;
};

/**
 * One literal's rereading against its own passage.
 *
 * @beta
 */
export type Verdict = Readonly<{
  literal: AnyLiteral;
  passage: Chunk;
  answer: EvidenceChoice;
  /** KEEP when the rereading admits the literal's sign; RETRACT otherwise. */
  standing: Standing;
}>;

/**
 * One derived violation in one round: the stated facts behind it and what became of them.
 *
 * @beta
 */
export type ViolationReport = Readonly<{
  atom: GroundAtom;
  /** The extracted literals the violation's proof rests on, each once. */
  evidence: readonly AnyLiteral[];
  verdicts: readonly Verdict[];
  retracted: readonly AnyLiteral[];
}>;

/**
 * One pass: the violations derived at its start and the rereadings they cost.
 *
 * @beta
 */
export type RecheckRound = Readonly<{
  round: number;
  violations: readonly ViolationReport[];
  requests: number;
}>;

/**
 * The outcome of a run: the knowledge base with unsupported literals retracted, the rounds,
 * and the violations still derivable when it stopped.
 *
 * @beta
 */
export type RecheckResult = Readonly<{
  /** Independent copy of the input with the retracted literals removed. */
  kb: KnowledgeBase;
  rounds: readonly RecheckRound[];
  retracted: readonly AnyLiteral[];
  /** Violations the rules still derive after the last round. */
  unresolved: readonly GroundAtom[];
  requests: number;
}>;

/**
 * Derive the given violation atoms, read the extracted facts behind each one again against
 * their passages, retract the facts the rereading no longer supports, and repeat until no
 * violation is derived, a pass retracts nothing, or `maxRounds` passes have run. The input
 * KB is not modified. Each violation query may carry variables; its true ground judgments
 * are the violations. Throws if a violation rests on evidence without a source, and
 * propagates corpus errors for sources that are not resolvable chunk ids.
 * @beta
 */
export async function recheck<M extends Metadata = Metadata>(
  corpus: Corpus<M>,
  kb: KnowledgeBase,
  violations: readonly Atom[],
  config: RecheckConfig = {},
): Promise<RecheckResult> {
  const admission = admissionPolicy(config.admission);
  const maxRounds = config.maxRounds ?? 2;
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
    throw new Error("maxRounds must be a positive integer");
  }
  const rechecker = jevRechecker(config.client);
  const output = kb.fork();
  const rounds: RecheckRound[] = [];
  const retracted: AnyLiteral[] = [];
  let requests = 0;
  let derived = deriveViolations(output, violations);
  for (let round = 1; round <= maxRounds && derived.length > 0; round += 1) {
    const reports: ViolationReport[] = [];
    // Each literal is reread once per round, however many violations rest on it.
    const evidenceByViolation = derived.map((judgment) => evidenceBehind(judgment));
    const literals = [...new Set(evidenceByViolation.flat())];
    const verdicts = new Map<AnyLiteral, Verdict>();
    const batches = groupByPassageAndPredicate(literals, corpus);
    for (const batch of batches) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- One request at a time; a round is a handful.
      const rereadings = await rechecker.recheck(batch);
      requests += 1;
      for (const { candidate, answer } of rereadings) {
        for (const literal of batch.literalsOf(candidate)) {
          verdicts.set(literal, {
            literal,
            passage: batch.passage,
            answer,
            standing: standingOf(literal, answer, admission),
          });
        }
      }
    }
    const dropped = literals.filter((literal) => verdicts.get(literal)?.standing === "RETRACT");
    output.retract(...dropped);
    retracted.push(...dropped);
    for (const [index, judgment] of derived.entries()) {
      const evidence = evidenceByViolation[index] ?? [];
      reports.push({
        atom: judgment.goal.atom,
        evidence,
        verdicts: evidence.flatMap((literal) => {
          const verdict = verdicts.get(literal);
          return verdict === undefined ? [] : [verdict];
        }),
        retracted: evidence.filter((literal) => dropped.includes(literal)),
      });
    }
    rounds.push({ round, violations: reports, requests: batches.length });
    derived = deriveViolations(output, violations);
    if (dropped.length === 0) {
      break;
    }
  }
  return {
    kb: output,
    rounds,
    retracted,
    unresolved: derived.map((judgment) => judgment.goal.atom),
    requests,
  };
}

/** The true ground judgments of the violation queries, in query order. */
function deriveViolations(
  kb: KnowledgeBase,
  violations: readonly Atom[],
): readonly QueryJudgment[] {
  return violations.flatMap((violation) =>
    queryAll(kb, violation).filter((judgment) => judgment.value === "true"),
  );
}

/**
 * The stored literals a true judgment rests on: the evidence leaves of its positive
 * supports, through rules and subgoals, each once in order of appearance. Only the
 * supports that made the judgment true are followed, so an `or` contributes the
 * alternatives that held, and a negated or primitive subgoal contributes nothing.
 * @beta
 */
export function evidenceBehind(judgment: Judgment): readonly AnyLiteral[] {
  const found: AnyLiteral[] = [];
  const seen = new Set<Judgment>();
  const walk = (node: Judgment): void => {
    if (node.value !== "true" || seen.has(node)) {
      return;
    }
    seen.add(node);
    for (const support of node.positive) {
      if (support.source === "evidence") {
        for (const literal of support.literals) {
          if (literal.sign === "+" && !found.includes(literal)) {
            found.push(literal);
          }
        }
      } else if (support.source === "rule") {
        walk(support.body);
      } else if (support.source === "subgoals") {
        for (const sub of support.judgments) {
          walk(sub);
        }
      }
    }
  };
  walk(judgment);
  return found;
}

type Batch = Readonly<{
  passage: Chunk;
  predicate: PredicateDeclaration;
  candidates: readonly Candidate[];
  literalsOf: (candidate: Candidate) => readonly AnyLiteral[];
}>;

/** One request per passage and predicate, each distinct atom a candidate. */
function groupByPassageAndPredicate<M extends Metadata>(
  literals: readonly AnyLiteral[],
  corpus: Corpus<M>,
): readonly Batch[] {
  const batches = new Map<
    string,
    { passage: Chunk; predicate: PredicateDeclaration; literals: AnyLiteral[] }
  >();
  for (const literal of literals) {
    const source = literal.metadata?.source;
    if (source === undefined) {
      throw new Error(`Cannot recheck ${formatAtom(literal.atom)}: evidence without a source`);
    }
    const key = `${source}\u0000${literal.atom.predicate.name}`;
    const batch = batches.get(key);
    if (batch === undefined) {
      const { chunk } = corpus.resolve(source);
      batches.set(key, { passage: chunk, predicate: literal.atom.predicate, literals: [literal] });
    } else {
      batch.literals.push(literal);
    }
  }
  return [...batches.values()].map(({ passage, predicate, literals: members }) => {
    const byCandidate = new Map<Candidate, AnyLiteral[]>();
    const byAtom = new Map<string, Candidate>();
    for (const literal of members) {
      const key = atomKey(literal.atom);
      let candidate = byAtom.get(key);
      if (candidate === undefined) {
        candidate = {
          id: `candidate_${String(byAtom.size)}`,
          atom: groundAtomOf(literal.atom),
          fields: Object.fromEntries(
            predicate.paramNames.map((name) => [
              name,
              encodeValue(candidateValue(literal.atom.fields[name])),
            ]),
          ),
        };
        byAtom.set(key, candidate);
        byCandidate.set(candidate, []);
      }
      byCandidate.get(candidate)?.push(literal);
    }
    return {
      passage,
      predicate,
      candidates: [...byCandidate.keys()],
      literalsOf: (candidate) => byCandidate.get(candidate) ?? [],
    };
  });
}

/** KEEP when the rereading admits the literal's own sign, by the classifier's admission rule. */
function standingOf(
  literal: AnyLiteral,
  answer: EvidenceChoice,
  policy: AdmissionPolicy,
): Standing {
  const { probabilities } = answer;
  const outcome = literal.sign === "+" ? "ASSERT" : "DENY";
  const strongest = Math.max(probabilities.ASSERT, probabilities.DENY);
  const admitted =
    probabilities.IRRELEVANT < strongest &&
    probabilities[outcome] >= policy.minimumProbability &&
    strongest - probabilities[outcome] <= policy.ambiguityMargin;
  return admitted ? "KEEP" : "RETRACT";
}

function groundAtomOf(atom: AnyAtom): GroundAtom {
  const fields: Record<string, CandidateValue> = {};
  for (const name of atom.predicate.paramNames) {
    fields[name] = candidateValue(atom.fields[name]);
  }
  return { predicate: atom.predicate, fields };
}

function candidateValue(value: unknown): CandidateValue {
  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
  ) {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- An object with an id is an entity by the core contract.
    return value as CandidateValue;
  }
  throw new Error("Cannot recheck an atom with an unbound or unsupported field");
}

function atomKey(atom: AnyAtom): string {
  return `${atom.predicate.name}(${atom.predicate.paramNames
    .map((name) => {
      const value = atom.fields[name];
      if (value instanceof Date) {
        return `date:${value.toISOString()}`;
      }
      if (typeof value === "object" && value !== null && "id" in value) {
        return `entity:${String(value.id)}`;
      }
      return `${typeof value}:${String(value)}`;
    })
    .join(",")})`;
}

function formatAtom({ predicate, fields }: AnyAtom): string {
  const values = predicate.paramNames.map((name) => {
    const value = fields[name];
    return typeof value === "object" && value !== null && "id" in value
      ? String(value.id)
      : String(value);
  });
  return `${predicate.name}(${values.join(", ")})`;
}
