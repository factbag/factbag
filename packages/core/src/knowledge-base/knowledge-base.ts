import type { Atom } from "../types/atom";
import { isAtomLike } from "../types/atom";
import type { PredicateDeclaration } from "../types/predicate";
import type { EvidenceMetadata } from "../types/evidence-metadata";
import type { AnyLiteral, NegativeLiteral, PositiveLiteral } from "../types/literal";
import type { Entity, PredicateSchema, RuntimeConstructor, RuntimeType } from "../types/schema";
import type { AnyRule, Rule } from "../types/rule";
import type { LiteralArgs, LiteralFilter, RuleBuilder } from "../dsl/types";
import { assertExclusiveDefinitions } from "./assertions/exclusive-definitions";

type EntityConstructor = RuntimeConstructor<unknown>;

/** Registry of known domain entities, keyed by constructor and id. */
export class EntityRegistry {
  private readonly entitiesByType = new Map<EntityConstructor, Map<string, Entity>>();

  /** Register entities so queries can enumerate and resolve them by id. */
  add(...entities: readonly Entity[]): void {
    for (const entity of entities) {
      const type = entity.constructor;
      if (!isEntityConstructor(type)) {
        continue;
      }
      let entitiesById = this.entitiesByType.get(type);
      if (entitiesById === undefined) {
        entitiesById = new Map();
        this.entitiesByType.set(type, entitiesById);
      }
      entitiesById.set(entity.id, entity);
    }
  }

  /** Look up a registered entity by its type and id. */
  get(type: RuntimeType<unknown>, id: string): Entity | undefined {
    if (!isEntityConstructor(type)) {
      return undefined;
    }
    return this.entitiesByType.get(type)?.get(id);
  }

  /** List the ids of every registered entity of a type. */
  ids(type: RuntimeType<unknown>): readonly string[] {
    if (!isEntityConstructor(type)) {
      return [];
    }
    return [...(this.entitiesByType.get(type)?.keys() ?? [])];
  }

  /** List all registered entities, retaining their original identities. */
  all(): readonly Entity[] {
    return [...this.entitiesByType.values()].flatMap((entities) => [...entities.values()]);
  }
}

function isEntityConstructor(type: unknown): type is EntityConstructor {
  return (
    typeof type === "function" &&
    type !== String &&
    type !== Number &&
    type !== Boolean &&
    type !== BigInt &&
    "prototype" in type &&
    typeof type.name === "string"
  );
}

/**
 * The store of accepted evidence and derivation rules.
 *
 * Evidence enters as signed literals via {@link KnowledgeBase.asserts} and
 * {@link KnowledgeBase.denies}; rules enter via the fluent
 * {@link KnowledgeBase.rule} builder. Queries evaluate against this store.
 */
export class KnowledgeBase {
  /** Registry of known domain entities, used to enumerate closed domains. */
  readonly entities: EntityRegistry = new EntityRegistry();

  private readonly storedLiterals: AnyLiteral[] = [];
  private readonly storedRules: AnyRule[] = [];

  /**
   * Create an independent store with the same evidence, rules, and registered entities.
   * Existing records retain their identities; additions and retractions affect only
   * their own store. This is a structural copy, not a deep clone of domain objects.
   */
  fork(): KnowledgeBase {
    const fork = new KnowledgeBase();
    fork.entities.add(...this.entities.all());
    fork.storedLiterals.push(...this.storedLiterals);
    fork.storedRules.push(...this.storedRules);
    return fork;
  }

  /**
   * Accept positive evidence for an atom, returning the stored literal.
   * Optional {@link EvidenceMetadata} records where the fact came from.
   *
   * @example
   * ```ts
   * kb.asserts(incomeFact({ person: alice, year: y2024, amountCents: 24_680_000 }), {
   *   source: "2024_w2",
   *   citation: "Wages, tips, other compensation: 246,800",
   * });
   * ```
   */
  asserts<Schema extends PredicateSchema>(
    atom: Atom<Schema>,
    metadata?: EvidenceMetadata,
  ): PositiveLiteral<Schema> {
    const literal =
      metadata === undefined
        ? ({ sign: "+", atom } as const)
        : ({ sign: "+", atom, metadata } as const);
    this.storedLiterals.push(literal);
    return literal;
  }

  /**
   * Accept negative evidence for an atom, returning the stored literal. A
   * denial is explicit counter-evidence — stronger than mere absence.
   */
  denies<Schema extends PredicateSchema>(
    atom: Atom<Schema>,
    metadata?: EvidenceMetadata,
  ): NegativeLiteral<Schema> {
    const literal =
      metadata === undefined
        ? ({ sign: "-", atom } as const)
        : ({ sign: "-", atom, metadata } as const);
    this.storedLiterals.push(literal);
    return literal;
  }

  /**
   * Start declaring a rule for a head atom; finish with the builder's `if`
   * (sufficient condition) or `iff` (exclusive definition).
   *
   * @throws {@link ExclusiveDefinitionProgrammerError} when the head
   * predicate ends up with an `iff` definition alongside any other rule.
   *
   * @example
   * ```ts
   * kb.rule(doctor({ person: P })).iff(
   *   and(passedMedicalSchool({ person: P }), hasActiveLicense({ person: P })),
   * );
   * ```
   */
  rule<Schema extends PredicateSchema>(head: Atom<Schema>): RuleBuilder<Schema> {
    return {
      if: (body) => this.addRule(head, "if", body),
      iff: (body) => this.addRule(head, "iff", body),
    };
  }

  /** Remove previously stored literals, matched by identity. */
  retract<const Literals extends readonly unknown[]>(
    ...literals: Literals & LiteralArgs<Literals>
  ): void {
    for (const literal of literals) {
      const index = this.storedLiterals.indexOf(literal);
      if (index !== -1) {
        this.storedLiterals.splice(index, 1);
      }
    }
  }

  /** List stored evidence literals, optionally filtered. */
  literals(filter?: LiteralFilter): readonly AnyLiteral[] {
    return filter === undefined ? [...this.storedLiterals] : this.storedLiterals.filter(filter);
  }

  /** List stored rules. */
  rules(): readonly AnyRule[] {
    return [...this.storedRules];
  }

  /** Predicates referenced by this KB's facts and rules, in discovery order. */
  predicates(): readonly PredicateDeclaration[] {
    const predicates = new Set<PredicateDeclaration>();
    const visited = new Set<object>();

    function visit(value: unknown): void {
      if (typeof value !== "object" || value === null || visited.has(value)) {
        return;
      }
      visited.add(value);
      if (isAtomLike(value)) {
        predicates.add(value.predicate);
        return;
      }
      for (const child of Object.values(value)) {
        visit(child);
      }
    }

    for (const literal of this.storedLiterals) {
      predicates.add(literal.atom.predicate);
    }
    for (const rule of this.storedRules) {
      predicates.add(rule.head.atom.predicate);
      visit(rule.body);
    }
    return [...predicates];
  }

  private addRule<Schema extends PredicateSchema, const Body>(
    head: Atom<Schema>,
    kind: Rule<Schema, Body>["kind"],
    body: Body,
  ): Rule<Schema, Body> {
    const rule = { kind, head: { sign: "+", atom: head }, body } as const;
    this.storedRules.push(rule);

    try {
      this.assertValid();
    } catch (error) {
      this.storedRules.pop();
      throw error;
    }

    return rule;
  }

  private assertValid(): void {
    assertExclusiveDefinitions(this.storedRules);
  }
}
