import { isRecord } from "../src/utils";

/** Read an object from an untrusted demo request. */
export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected object");
  }
  return value;
}
