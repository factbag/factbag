/**
 * Classification and resolution over TypeSafe's Jev.
 *
 * @packageDocumentation
 */
export { classifier } from "./classifier/classifier";
export {
  createConfig,
  DEFAULT_AMBIGUITY_MARGIN,
  DEFAULT_CANDIDATE_PRODUCT_CUTOFF,
  DEFAULT_MINIMUM_PROBABILITY,
  DEFAULT_PREDICATE_THRESHOLD,
  DEFAULT_ROUTING_ENABLED,
  DEFAULT_SYMBOL_THRESHOLD,
} from "./config";
export type { Config } from "./config";
export { resolver } from "./resolve";
export type { Job, Run } from "./types/run";
