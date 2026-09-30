/**
 * Interactive teaching widgets for the docs site and blog. Every widget is a
 * self-contained React client component styled with Tailwind utilities; see
 * `theme.css` for the tokens they expect the host to provide.
 */
export { CountRangeExplorer } from "./CountRangeExplorer";
export { EvaluationGraph } from "./EvaluationGraph";
export { EverydayDecision } from "./EverydayDecision";
export { LiveSolverExplorer } from "./LiveSolverExplorer";
export { LiveSolverTree } from "./LiveSolverTree";
export { ProofTreeExplorer } from "./ProofTreeExplorer";
export { TrialEligibilityTree } from "./TrialEligibilityTree";

export { ProofTree } from "./kb/proof-tree";
export { ValuePill } from "./kb/value-pill";
export { WidgetChrome } from "./lib/ui";
export { VERDICT } from "./theme";
