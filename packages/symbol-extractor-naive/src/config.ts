import type { Entity, RuntimeConstructor } from "@factbag/core/dsl";

/**
 * Optional inputs to extraction. Candidates are chosen by each requested field's
 * type, so no per-field configuration is needed.
 * @beta
 */
export type SymbolExtractorConfig = {
  /**
   * Factories that turn recognized names into entities, one per entity class. Fields
   * of other entity classes receive only alias matches; Jev still offers registered
   * entities.
   */
  readonly entities?: readonly (readonly [RuntimeConstructor<Entity>, (name: string) => Entity])[];
  /**
   * Known phrases and the values they denote, matched literally and case-sensitively at
   * word boundaries. Each value is offered to fields of its own type. Repeat a phrase to
   * keep alternative interpretations.
   */
  readonly aliases?: readonly { readonly text: string; readonly value: Entity | string }[];
};

/** A validated snapshot of the configuration. */
export type Settings = {
  readonly factories: ReadonlyMap<unknown, (name: string) => Entity>;
  readonly aliases: readonly { readonly text: string; readonly value: Entity | string }[];
};

const SCALARS = new Set<unknown>([String, Number, Date, Boolean, BigInt]);

/** Snapshot configuration and reject invalid entries before any scanning. */
export function configure(config: SymbolExtractorConfig): Settings {
  const factories = new Map<unknown, (name: string) => Entity>();
  for (const [type, create] of config.entities ?? []) {
    if (!isEntityClass(type) || !isFunction(create) || factories.has(type)) {
      throw new TypeError(`Invalid entity factory for ${type.name}`);
    }
    factories.set(type, create);
  }
  const aliases = (config.aliases ?? []).map(({ text, value }) => {
    if (text.length === 0 || !isAliasValue(value)) {
      throw new TypeError(`Invalid alias "${text}"`);
    }
    return { text, value };
  });
  return { factories, aliases };
}

/** A constructable class other than a scalar type. Checked at runtime for untyped callers. */
function isEntityClass(type: unknown): boolean {
  return typeof type === "function" && "prototype" in type && !SCALARS.has(type);
}

function isFunction(value: unknown): boolean {
  return typeof value === "function";
}

function isAliasValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string")
  );
}
