/** Read an object from an untrusted demo request. */
export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected object");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A non-array object is a record of unknowns.
  return value as Record<string, unknown>;
}
