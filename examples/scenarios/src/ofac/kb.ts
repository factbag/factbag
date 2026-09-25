import { and, predicate, variable } from "@factbag/core/dsl";
import { KnowledgeBase } from "@factbag/core/kb";
import { dates } from "./dates";

export class Party {
  constructor(
    readonly id: string,
    readonly fullName: string,
    readonly jurisdiction: string,
  ) {}
}
export class Transaction {
  constructor(readonly id: string) {}
}
export class Industry {
  constructor(readonly id: string) {}
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Infer native predicate/entity types once for the scenario's return type.
export function createOfacKB() {
  const { asOf } = dates;
  const kb = new KnowledgeBase();
  const volkov = new Party("volkov", "Dmitry A. Volkov", "Russia");
  const ural = new Party("ural", "Ural Capital Partners Fund II", "Russia");
  const transaction = new Transaction("TXN-2025-830044");
  const agriculture = new Industry("agriculture");
  kb.entities.add(volkov, ural, transaction, agriculture);

  const sanctioned = predicate(
    "is_sanctioned_person",
    { party: Party },
    {
      description: `The party has an active SDN designation as of ${asOf}. Evaluate effective dates; a removal supersedes an earlier designation, while a subsequent redesignation restores listed status. Ownership-derived blocking is not direct listing.`,
    },
  );
  const ownsMajority = predicate(
    "owns_majority",
    { owner: Party, entity: Party },
    {
      description: `The owner holds at least 50% of the entity as of ${asOf}. Evaluate ownership records in date order; an older register does not negate a more recent record.`,
    },
  );
  const controls = predicate(
    "controls",
    { controller: Party, entity: Party },
    {
      description: `The controller exercises formal control over the entity as of ${asOf} through board appointment rights or contractual management authority.`,
    },
  );
  const partyToTransaction = predicate(
    "is_party_to_transaction",
    { party: Party, transaction: Transaction },
    {
      description: "The party is involved in the specified transaction.",
    },
  );
  const transactionInIndustry = predicate(
    "transaction_in_industry",
    { transaction: Transaction, industry: Industry },
    {
      description: `The transaction is officially classified in this industry as of ${asOf}. Tentative suggestions in an earlier discussion do not establish or deny the final classification.`,
    },
  );
  const sanctionedIndustry = predicate("is_sanctioned_industry", { industry: Industry });
  const blocked = predicate("is_blocked", { party: Party });
  const prohibited = predicate("is_prohibited", { transaction: Transaction });

  const X = variable("X");
  const T = variable("T");
  const I = variable("I");
  const Y = variable("Y");
  kb.rule(blocked({ party: X })).if(sanctioned({ party: X }));
  // Blocking propagates down any ownership or control edge, to any depth. Both still
  // require evidence; neither is a stipulated base fact.
  kb.rule(blocked({ party: Y })).if(
    and(ownsMajority({ owner: X, entity: Y }), blocked({ party: X })),
  );
  kb.rule(blocked({ party: Y })).if(
    and(controls({ controller: X, entity: Y }), blocked({ party: X })),
  );
  kb.rule(prohibited({ transaction: T })).if(
    and(
      partyToTransaction({ party: X, transaction: T }),
      blocked({ party: X }),
      transactionInIndustry({ transaction: T, industry: I }),
      sanctionedIndustry({ industry: I }),
    ),
  );
  // A stipulated benchmark input, supplied in the original scenario's industry list.
  kb.asserts(sanctionedIndustry({ industry: agriculture }));

  return {
    kb,
    entities: { volkov, ural, transaction, agriculture },
    predicates: {
      sanctioned,
      ownsMajority,
      controls,
      partyToTransaction,
      transactionInIndustry,
      sanctionedIndustry,
      blocked,
      prohibited,
    },
  };
}
