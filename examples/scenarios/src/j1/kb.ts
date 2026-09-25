import { predicate, variable } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";

class Person {
  constructor(
    readonly id: string,
    readonly name: string,
  ) {}
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Infer native predicate/entity types once for the scenario's return type.
export function createJ1KB() {
  const kb = new KnowledgeBase();
  const applicant = new Person("andrei_kovacs", "Dr. Andrei Kovacs");
  const otherApplicant = new Person("wei_lin_huang", "Dr. Wei-Lin Huang");
  kb.entities.add(applicant);
  const tenureTrack = predicate(
    "is_tenure_track_candidate",
    { person: Person },
    {
      description:
        "The applicant is a candidate for a tenure-track position at the host institution. A visiting appointment alone is insufficient; another person's candidacy is irrelevant.",
    },
  );
  const disqualified = predicate("is_disqualified_ito_s_62_20_d_1", { person: Person });
  const person = variable("person");
  kb.rule(disqualified({ person })).if(tenureTrack({ person }));
  return { kb, applicant, otherApplicant, predicates: { tenureTrack, disqualified } };
}
