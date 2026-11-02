import type { Normalized } from "./config";
import type { Model } from "./types/model";

/**
 * Settings as the pipeline sees them: every default applied, and a model in place of the
 * provider options it was built from, so no stage can reach past the model to a vendor.
 */
export type Pipeline = Normalized & { readonly model: Model };
