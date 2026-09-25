import { predicate, type Predicate } from "../../src/dsl";
import { Person } from "./common";

export const passedMedicalSchool: Predicate<{
  person: typeof Person;
}> = predicate("passed_medical_school", {
  person: Person,
});

export const hasActiveLicense: Predicate<{
  person: typeof Person;
}> = predicate("has_active_license", {
  person: Person,
});

export const doctor: Predicate<{
  person: typeof Person;
}> = predicate("doctor", { person: Person });

/**
 * Evidence predicate used to exercise explicit negative support: a rule body may
 * require accepted negative evidence for `eatenApple`, distinct from the mere
 * absence of a positive `eatenApple` fact.
 */
export const eatenApple: Predicate<{
  person: typeof Person;
}> = predicate("eaten_apple", { person: Person });
