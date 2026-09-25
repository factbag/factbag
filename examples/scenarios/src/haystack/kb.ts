import { createOfacKB, Industry, Party, Transaction } from "../ofac/kb";

/**
 * The intermediaries between the listed person and the company paying the invoice. Plain
 * holding companies: names like "Nominee Services" read as holding shares for someone else,
 * which measurably weakens the model's reading of an otherwise identical certificate.
 */
export const chain = [
  new Party("harlow", "Harlow Holdings Limited", "Cyprus"),
  new Party("orpheus", "Orpheus Trading Company Limited", "Malta"),
  new Party("castellan", "Castellan Participations SARL", "Luxembourg"),
  new Party("ardglass", "Ardglass Holdings Limited", "Ireland"),
  new Party("piave", "Piave Investimenti SpA", "Italy"),
  new Party("valmer", "Valmer Capital SA", "Switzerland"),
] as const;

/** Unrelated businesses, their payments and their sectors, so the chain has company. */
export const distractors = {
  parties: [
    new Party("meridian", "Meridian Process Systems plc", "United Kingdom"),
    new Party("calder", "Calder Industrial Holdings AB", "Sweden"),
    new Party("okapi", "Okapi Logistics Group NV", "Netherlands"),
    new Party("tessera", "Tessera Precision Components SA", "France"),
  ],
  transactions: [new Transaction("TXN-2025-114872"), new Transaction("TXN-2025-559301")],
  industries: [new Industry("logistics"), new Industry("precision_engineering")],
} as const;

/**
 * The OFAC knowledge base with the ownership rule generalised to any depth, and with the
 * intermediaries and unrelated entities registered. Blocking now has to be derived link by
 * link: `is_blocked(Y)` holds when a blocked party owns a majority of Y, whoever that is.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type -- Infer the OFAC factory's types once.
export function createHaystackKB() {
  const base = createOfacKB();
  base.kb.entities.add(
    ...chain,
    ...distractors.parties,
    ...distractors.transactions,
    ...distractors.industries,
  );
  // The generic ownership and control rules come from the OFAC knowledge base and carry
  // blocking down the chain to any depth; each link still needs its own evidence.
  return base;
}

/** Each ownership link the chain depends on, from the listed person down to the payer. */
export function ownershipLinks(
  entities: ReturnType<typeof createOfacKB>["entities"],
): readonly { owner: Party; entity: Party }[] {
  const parties = [entities.volkov, ...chain, entities.ural];
  return parties.slice(0, -1).map((owner, index) => ({
    owner,
    entity: parties[index + 1] ?? entities.ural,
  }));
}
