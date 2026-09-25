import { predicate, variable, type Predicate, type Var } from "../../src/dsl";
import type { Entity } from "../../src/dsl/types";

/** ## Entities */
export class Party implements Entity {
  constructor(readonly id: string) {}
}

export const dmitry: Party = new Party("dmitry_volkov");
export const volga: Party = new Party("volga_industrial_group");
export const neva: Party = new Party("neva_trading_company");

/** ## Predicates */
export const ownershipInterestFact: Predicate<{
  owner: typeof Party;
  entity: typeof Party;
  basisPoints: NumberConstructor;
}> = predicate("ownership_interest_fact", {
  owner: Party,
  entity: Party,
  basisPoints: Number,
});
export const effectiveOwnershipBps: Predicate<{
  owner: typeof Party;
  entity: typeof Party;
  basisPoints: NumberConstructor;
}> = predicate("effective_ownership_bps", {
  owner: Party,
  entity: Party,
  basisPoints: Number,
});

/** ## Variables */
export const Owner: Var<"Owner"> = variable("Owner");
export const EntityVar: Var<"Entity"> = variable("Entity");
export const Intermediate: Var<"Intermediate"> = variable("Intermediate");
export const DirectBps: Var<"DirectBps"> = variable("DirectBps");
export const ParentBps: Var<"ParentBps"> = variable("ParentBps");
export const ChildBps: Var<"ChildBps"> = variable("ChildBps");
export const EffectiveBps: Var<"EffectiveBps"> = variable("EffectiveBps");
