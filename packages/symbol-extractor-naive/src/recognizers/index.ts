import { aliases } from "./aliases";
import { dates } from "./dates";
import { figures } from "./figures";
import { names } from "./names";
import type { Recognizer, RecognizerName } from "./types";

export type Registry = Readonly<Record<RecognizerName, Recognizer>>;

/** Every recognizer. Prerequisites provide masking context only. */
export const recognizers: Registry = { dates, figures, aliases, names };

/** Recognizer names in the order their values are offered. */
export const RECOGNIZER_NAMES: readonly RecognizerName[] = ["dates", "figures", "aliases", "names"];
