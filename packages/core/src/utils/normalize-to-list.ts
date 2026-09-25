export type OneOrMany<Value> = Value | readonly Value[];

export function normalizeToList<Value>(value: OneOrMany<Value>): readonly Value[] {
  return isReadonlyArray(value) ? value : [value];
}

function isReadonlyArray<Value>(value: OneOrMany<Value>): value is readonly Value[] {
  return Array.isArray(value);
}
