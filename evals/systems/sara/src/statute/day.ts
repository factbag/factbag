/** Parses a `YYYY-MM-DD` day to its UTC midnight, the form SARA's dates take. */
export function day(text: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new Error(`Not a YYYY-MM-DD day: ${text}`);
  }
  const value = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== text) {
    throw new Error(`Invalid day: ${text}`);
  }
  return value;
}
