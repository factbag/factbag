/** Reject removed scalar types before building rules or atoms. */
export function assertSupportedValue(value: unknown): void {
  if (typeof value === "bigint" || value === BigInt) {
    throw new TypeError("bigint is not supported; use number values and Number fields");
  }
}
