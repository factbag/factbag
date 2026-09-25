/**
 * A domain entity carries its own identity: the same type with the same id
 * is the same entity, however many times it is constructed. Whoever mints
 * entities owns the uniqueness of ids, exactly like a primary key.
 */
export type Entity = Readonly<{
  id: string;
}>;

/** An explicit finite domain of string values for a predicate field. */
export type EnumType<Value extends string = string> = Readonly<{
  kind: "enum";
  values: readonly Value[];
}>;

/** Runtime constructor used to validate a predicate field value. */
export type RuntimeConstructor<T> = (abstract new (...args: never[]) => T) &
  Readonly<{
    prototype: T;
    name: string;
  }>;

/** Any runtime validator accepted in a predicate schema field. */
export type RuntimeType<T> =
  | EnumType
  | RuntimeConstructor<T & Entity>
  | BigIntConstructor
  | BooleanConstructor
  | DateConstructor
  | NumberConstructor
  | StringConstructor;

/** A predicate schema maps field names to runtime validators/constructors. */
export type PredicateSchema = Readonly<
  Record<
    string,
    | BigIntConstructor
    | BooleanConstructor
    | DateConstructor
    | NumberConstructor
    | StringConstructor
    | EnumType
    | ((abstract new (...args: never[]) => Entity) &
        Readonly<{
          prototype: Entity;
          name: string;
        }>)
  >
>;

/**
 * Convert a runtime constructor in a predicate schema to its TypeScript value
 * type. A schema-erased constructor (the bare `RuntimeConstructor<Entity>`)
 * infers `unknown`, so erased atoms keep permissive field types.
 */
export type InferRuntime<T> =
  T extends EnumType<infer Value>
    ? Value
    : T extends StringConstructor
      ? string
      : T extends NumberConstructor
        ? number
        : T extends BooleanConstructor
          ? boolean
          : T extends BigIntConstructor
            ? bigint
            : T extends DateConstructor
              ? Date
              : T extends { prototype: infer Value }
                ? RuntimeConstructor<Entity> extends T
                  ? unknown
                  : Value
                : never;
