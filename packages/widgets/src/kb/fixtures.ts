/**
 * Tiny knowledge bases for this package's tests and stories: one clean
 * derivation and one conflict, jointly covering evidence with provenance,
 * closed-world absence, operators, rules, and both signs.
 */
import {
  and,
  assertGroundAtom,
  closedPredicate,
  not,
  predicate,
  variable,
} from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { query, type Judgment } from "@factbag/core/query";

class Person {
  constructor(readonly id: string) {}
}

export function libraryCardJudgment(options?: { readonly revoked?: boolean }): Judgment {
  const P = variable("P");
  const hasCard = predicate("has_card", { person: Person });
  const cardRevoked = closedPredicate("card_revoked", { person: Person });
  const mayBorrow = predicate("may_borrow", { person: Person });
  const mia = new Person("mia");

  const kb = new KnowledgeBase();
  kb.rule(mayBorrow({ person: P })).iff(
    and(hasCard({ person: P }), not(cardRevoked({ person: P }))),
  );
  kb.asserts(hasCard({ person: mia }), {
    citation: "Mia was issued card #4417 at the front desk.",
    source: "front_desk",
  });
  if (options?.revoked === true) {
    kb.asserts(cardRevoked({ person: mia }), {
      citation: "Card #4417 was revoked over unpaid fines.",
      source: "fines_office",
    });
  }

  const goal = mayBorrow({ person: mia });
  assertGroundAtom(goal);
  return query(kb, goal);
}

export function contestedBoatJudgment(): Judgment {
  const P = variable("P");
  const owns = predicate("owns_the_boat", { person: Person });
  const maySell = predicate("may_sell_the_boat", { person: Person });
  const alice = new Person("alice");

  const kb = new KnowledgeBase();
  kb.rule(maySell({ person: P })).iff(owns({ person: P }));
  kb.asserts(owns({ person: alice }), {
    citation: "The national ship registry lists Alice as sole owner.",
    source: "ship_registry",
  });
  kb.denies(owns({ person: alice }), {
    citation: "The harbor master's ledger shows the boat was sold last spring.",
    source: "harbor_master",
  });

  const goal = maySell({ person: alice });
  assertGroundAtom(goal);
  return query(kb, goal);
}
