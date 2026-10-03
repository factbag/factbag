/**
 * Display metadata for the four-valued verdict lattice. Colors reference the
 * app-level semantic tokens declared in theme.css, so an app can retheme the
 * lattice without touching any component.
 */
import type { GoalValue } from "@factbag/core/query";
import { CircleAlert, CircleCheck, CircleQuestionMark, X, type LucideIcon } from "lucide-react";

type VerdictMeta = {
  readonly border: string;
  readonly color: string;
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly pill: string;
  readonly symbol: string;
  readonly text: string;
  readonly word: string;
};

export const VERDICT: Record<GoalValue, VerdictMeta> = {
  conflicted: {
    border: "border-attention",
    color: "var(--color-attention)",
    Icon: CircleAlert,
    label: "conflicted",
    pill: "bg-attention",
    symbol: "!",
    text: "text-attention",
    word: "Disagree",
  },
  false: {
    border: "border-negative",
    color: "var(--color-negative)",
    Icon: X,
    label: "false",
    pill: "bg-negative",
    symbol: "⊥",
    text: "text-negative",
    word: "No",
  },
  true: {
    border: "border-positive",
    color: "var(--color-positive)",
    Icon: CircleCheck,
    label: "true",
    pill: "bg-positive",
    symbol: "⊤",
    text: "text-positive",
    word: "Yes",
  },
  unknown: {
    border: "border-warning",
    color: "var(--color-warning)",
    Icon: CircleQuestionMark,
    label: "unknown",
    pill: "bg-warning",
    symbol: "?",
    text: "text-warning",
    word: "Don't know",
  },
};
