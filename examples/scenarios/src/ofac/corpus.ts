import type { GroundAtom } from "@factbag/core/dsl";
import type { Literal } from "@factbag/core/kb";
import { Corpus } from "@factbag/corpus";
import type { DocumentFactory, PredicateDocuments, ScenarioMetadata } from "../types";
import { sharedNeutralDocuments } from "../shared/documents";
import { renderTemplate } from "../templates";
import { dates } from "./dates";
import type { createOfacKB } from "./kb";

/** Every OFAC document: evidence for each target, near misses, and shared background. */
export function createOfacCorpus(base: ReturnType<typeof createOfacKB>): {
  corpus: Corpus<ScenarioMetadata>;
  targets: readonly GroundAtom[];
} {
  const { targets, documents } = createOfacDocuments(base);
  const corpus = new Corpus<ScenarioMetadata>();
  corpus.add(
    [
      ...documents.sanctioned.assert,
      ...documents.partyToTransaction.assert,
      ...documents.transactionInIndustry.assert,
      ...documents.ownsMajority.assert,
      ...documents.sanctioned.nearMiss,
      ...documents.transactionInIndustry.nearMiss,
      ...documents.ownsMajority.nearMiss,
      ...documents.neutral,
    ].map((createDocument) => createDocument()),
  );
  return { corpus, targets };
}

// oxlint-disable-next-line typescript/explicit-function-return-type -- Preserve named collections without duplicating their types.
function createOfacDocuments(base: ReturnType<typeof createOfacKB>) {
  const {
    entities: { volkov, ural, transaction, agriculture },
    predicates: { sanctioned, ownsMajority, partyToTransaction, transactionInIndustry },
  } = base;

  const listing = sanctioned({ party: volkov });
  const involvement = partyToTransaction({ party: ural, transaction });
  const industry = transactionInIndustry({ transaction, industry: agriculture });
  const ownership = ownsMajority({ owner: volkov, entity: ural });
  const targets = [listing, involvement, industry, ownership];
  const document =
    (
      file: URL,
      documentId: string,
      evidence: readonly Literal[],
      kind: ScenarioMetadata["kind"] = "evidence",
    ): DocumentFactory =>
    () => ({
      documentId,
      text: renderTemplate(file, {
        ownerName: volkov.fullName,
        ownerJurisdiction: volkov.jurisdiction,
        entityName: ural.fullName,
        entityJurisdiction: ural.jurisdiction,
        transactionId: transaction.id,
        industryName: agriculture.id,
        ...dates,
      }),
      metadata: {
        kind,
        scope: "specific",
        evidence: [...evidence],
        irrelevantTo: targets.filter((atom) => !evidence.some((literal) => literal.atom === atom)),
      },
    });
  const linked = {
    sanctioned: {
      predicate: sanctioned,
      assert: [
        document(
          new URL("../../data/ofac/templates/sanctioned-person-designation.txt", import.meta.url),
          "ofac/sdn-listing",
          [{ sign: "+", atom: listing }],
        ),
      ],
      nearMiss: [
        document(
          new URL(
            "../../data/ofac/templates/sanctioned-person-historical-removal.txt",
            import.meta.url,
          ),
          "ofac/sdn-removal",
          [],
          "near-miss",
        ),
      ],
    },
    partyToTransaction: {
      predicate: partyToTransaction,
      assert: [
        document(
          new URL("../../data/ofac/templates/party-to-transaction-payment.txt", import.meta.url),
          "ofac/wire-transfer",
          [{ sign: "+", atom: involvement }],
        ),
      ],
    },
    transactionInIndustry: {
      predicate: transactionInIndustry,
      assert: [
        document(
          new URL(
            "../../data/ofac/templates/transaction-in-industry-classification.txt",
            import.meta.url,
          ),
          "ofac/industry-classification",
          [{ sign: "+", atom: industry }],
        ),
      ],
      nearMiss: [
        document(
          new URL(
            "../../data/ofac/templates/transaction-in-industry-discussion.txt",
            import.meta.url,
          ),
          "ofac/industry-discussion",
          [],
          "near-miss",
        ),
      ],
    },
    ownsMajority: {
      predicate: ownsMajority,
      assert: [
        document(
          new URL("../../data/ofac/templates/owns-majority-share-certificate.txt", import.meta.url),
          "ofac/share-certificate",
          [{ sign: "+", atom: ownership }],
        ),
      ],
      nearMiss: [
        document(
          new URL(
            "../../data/ofac/templates/owns-majority-historical-register.txt",
            import.meta.url,
          ),
          "ofac/share-register-superseded",
          [],
          "near-miss",
        ),
      ],
    },
  } satisfies Record<string, PredicateDocuments>;
  return { targets, documents: { ...linked, neutral: sharedNeutralDocuments(targets) } };
}
