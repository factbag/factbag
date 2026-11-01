import type { TypeSafeClient } from "@typesafe-ai/sdk";

/** Jev settings. Model, timeout, and retry settings belong to the SDK client. @beta */
export type Config = {
  /** Defaults to a lazy TypeSafeClient configured from TYPESAFE_* environment variables. */
  readonly client?: TypeSafeClient;
  /** Minimum probability for admitting signed evidence or retracting a passage, default 0.4. */
  readonly minimumProbability?: number;
  /** Classification: maximum gap from the strongest signed outcome. Resolution: required RETRACT lead over KEEP. Default 0. */
  readonly ambiguityMargin?: number;
};
