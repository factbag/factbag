/**
 * Fill a knowledge base from one text with the staged Jev classifier: a relevance pass over
 * the predicates, a participant pass over the role values, then the final classification
 * of the candidates that remain. The caller supplies the base knowledge base with its rules
 * and entities, the fact predicates to fill, and the scalar domains the text offers; this
 * runs the three passes with the library's defaults and reports what it admitted, with a
 * JSON-safe audit of the routing. Nothing here knows any benchmark.
 */
import type { Entity, PredicateDeclaration } from "@factbag/core/dsl";
import type { AnyLiteral, KnowledgeBase } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import { guard } from "@factbag/guards";
import type { AdmissionPolicy, Assessment, ScalarDomains } from "@factbag/jev/classifier";
import { stagedClassifier } from "@factbag/jev/staged";
import type { StagedConfig, StagedInspection } from "@factbag/jev/staged";
import type { MeteredClient } from "./meter";
import { pool } from "./pool";

export type Routing = Pick<
  StagedConfig,
  "relevanceThreshold" | "participantThreshold" | "candidateProductCutoff"
>;

/** The staged filter's development settings, unchanged since it was ported. */
export const DEFAULT_ROUTING: Required<Routing> = {
  relevanceThreshold: 0.3,
  participantThreshold: 0.3,
  candidateProductCutoff: 16,
};

export type StagedOptions = Readonly<{
  client: MeteredClient;
  /** The rules and entities the facts join; forked by the classifier, not written to. */
  kb: KnowledgeBase;
  /** The fact predicates to fill. */
  predicates: readonly PredicateDeclaration[];
  /** The entity type the predicates' entity fields range over. */
  entityType: abstract new (...args: never[]) => Entity;
  /** How many entities the text offers. */
  entities: number;
  domains: ScalarDomains;
  /** Routing thresholds; whatever is left out takes {@link DEFAULT_ROUTING}. */
  routing?: Partial<Routing>;
  admission?: AdmissionPolicy;
  /** Requests in flight for one text. */
  concurrency?: number;
}>;

/** JSON-safe routing audit, without predicate objects or functions. */
export type RoutingAudit = Omit<StagedInspection, "decisions" | "candidates"> & {
  source: string;
  decisions: readonly (Omit<StagedInspection["decisions"][number], "predicate"> & {
    predicate: string;
  })[];
  candidates: readonly (Omit<StagedInspection["candidates"][number], "predicate"> & {
    predicate: string;
  })[];
};

export type StagedGrounding = Readonly<{
  kb: KnowledgeBase;
  /** The one-document corpus the facts were read from; their sources are its chunk ids. */
  corpus: Corpus;
  /** Fact predicates left out because the text offers no candidates for one of their fields. */
  unclassified: readonly string[];
  /** Every admitted fact literal, for the results file. */
  literals: readonly AnyLiteral[];
  assessments: readonly Assessment[];
  requests: number;
  routing: readonly RoutingAudit[];
}>;

export async function groundStaged(text: string, options: StagedOptions): Promise<StagedGrounding> {
  let access = guard(options.kb);
  const unclassified: string[] = [];
  for (const declaration of options.predicates) {
    if (classifiable(declaration, options)) {
      access = access.permit("assert", declaration).permit("deny", declaration);
    } else {
      unclassified.push(declaration.name);
    }
  }
  const corpus = new Corpus();
  corpus.add({ documentId: "text", text });
  const config = {
    client: options.client,
    ...(options.admission === undefined ? {} : { admission: options.admission }),
    domains: options.domains,
  };
  const assessments: Assessment[] = [];
  const routing: RoutingAudit[] = [];
  let requests = 0;
  const run = stagedClassifier(corpus, access, {
    ...config,
    ...DEFAULT_ROUTING,
    ...options.routing,
    routingClient: options.client,
  });
  await pool([...run], 1, async (chunk) => {
    await pool(chunk.relevance, options.concurrency ?? 4, async (job) => {
      await job.execute();
    });
    await pool(chunk.participants(), options.concurrency ?? 4, async (job) => {
      await job.execute();
    });
    await pool(chunk.classification(), options.concurrency ?? 4, async (job) => {
      assessments.push(await job.execute());
    });
    const inspection = chunk.inspect();
    routing.push({
      ...inspection,
      source: chunk.source,
      decisions: inspection.decisions.map(({ predicate, ...decision }) => ({
        ...decision,
        predicate: predicate.name,
      })),
      candidates: inspection.candidates.map(({ predicate, ...counts }) => ({
        ...counts,
        predicate: predicate.name,
      })),
    });
    requests +=
      inspection.relevance.requests +
      inspection.participants.requests +
      inspection.classification.requests;
  });
  const output: KnowledgeBase = run.kb;
  const facts = new Set<string>(options.predicates.map((declaration) => declaration.name));
  return {
    kb: output,
    corpus,
    unclassified,
    literals: output.literals((literal) => facts.has(literal.atom.predicate.name)),
    assessments,
    requests,
    routing,
  };
}

/**
 * Jev rejects a predicate with no candidates: one whose scalar field has an empty domain,
 * or one naming more distinct entities than the text does. Such facts stay unknown, and the
 * grounding reports which they were. Since rules read absence as falsity for closed
 * predicates, an entity or value the scanner did not find is not merely unknown to the
 * facts: whatever would have been said of it is taken as not holding.
 */
function classifiable(
  declaration: PredicateDeclaration,
  options: Pick<StagedOptions, "domains" | "entityType" | "entities">,
): boolean {
  const types = Object.values(declaration.params);
  const persons = types.filter((type) => type === options.entityType).length;
  if (persons > options.entities) {
    return false;
  }
  return Object.entries(declaration.params).every(([name, type]) => {
    const candidates =
      options.domains.fields?.[name] ??
      (type === Date
        ? options.domains.Date
        : type === Number
          ? options.domains.Number
          : type === String
            ? options.domains.String
            : undefined);
    return candidates === undefined || candidates.length > 0;
  });
}

/** Render an atom's fields for logs and results: entity ids, ISO days, decimal numbers. */
export function renderFields(fields: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [name, renderValue(value)]),
  );
}

function renderValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    return String(value.id);
  }
  return JSON.stringify(value);
}
