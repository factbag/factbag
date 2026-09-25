export class AssertionError extends Error {
  constructor(message = "Assertion failed") {
    super(message);
    this.name = "AssertionError";
  }
}

export function assert(condition: boolean, message = "Assertion failed"): asserts condition {
  if (condition) {
    return;
  }

  throw new AssertionError(message);
}
