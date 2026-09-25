import { predicate, variable, type Predicate, type Var } from "../../src/dsl";
import type { Entity } from "../../src/dsl/types";

/** ## Entities */
export class Patient implements Entity {
  constructor(readonly id: string) {}
}

export class Trial implements Entity {
  constructor(readonly id: string) {}
}

export const maya: Patient = new Patient("maya_patel");
export const leo: Patient = new Patient("leo_nguyen");
export const studyRx204: Trial = new Trial("study_rx_204");

/** ## Eligibility predicates */
export const meetsInclusionCriteria: Predicate<{
  patient: typeof Patient;
  trial: typeof Trial;
}> = predicate("meets_inclusion_criteria", {
  patient: Patient,
  trial: Trial,
});

/** ## Date-window predicates */
export const consentDate: Predicate<{
  patient: typeof Patient;
  trial: typeof Trial;
  date: DateConstructor;
}> = predicate("consent_date", {
  patient: Patient,
  trial: Trial,
  date: Date,
});
export const ecogScore: Predicate<{
  patient: typeof Patient;
  date: DateConstructor;
  score: NumberConstructor;
}> = predicate("ecog_score", {
  patient: Patient,
  date: Date,
  score: Number,
});
export const adequatePerformanceStatus: Predicate<{
  patient: typeof Patient;
  trial: typeof Trial;
}> = predicate("adequate_performance_status", {
  patient: Patient,
  trial: Trial,
});

/** ## Contradiction-review predicate */
export const activeAutoimmuneCondition: Predicate<{
  patient: typeof Patient;
}> = predicate("active_autoimmune_condition", {
  patient: Patient,
});

/** ## Date-window variables */
export const VisitDate: Var<"VisitDate"> = variable("VisitDate");
export const ConsentDate: Var<"ConsentDate"> = variable("ConsentDate");
export const Score: Var<"Score"> = variable("Score");
