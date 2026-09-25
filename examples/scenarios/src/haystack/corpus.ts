import type { GroundAtom } from "@factbag/core/dsl";
import type { DocumentInput } from "@factbag/corpus";
import type { ScenarioMetadata } from "../types";
import { Corpus } from "@factbag/corpus";
import { sharedNeutralDocuments } from "../shared/documents";
import { dates } from "../ofac/dates";
import { renderTemplate } from "../templates";
import { distractors, ownershipLinks } from "./kb";
import type { Party } from "../ofac/kb";
import type { createHaystackKB } from "./kb";

/** Dates every OFAC template expects, shared by the chain's records. */
const dateVariables: Readonly<Record<string, string>> = { ...dates };

/** One unrelated business, and the numbers its paperwork is filled in with. */
type Business = Readonly<Record<string, string>>;

/** Six businesses with nothing to do with the question, paired with the registered parties. */
const profiles: readonly Business[] = [
  {
    companyCity: "Sheffield",
    segmentName: "process equipment",
    projectName: "Kestrel",
    supplierName: "Ardan Steel",
    chairName: "A. Whitfield",
    directorName: "P. Nayar",
    bankName: "Northbridge Bank",
    holderName: "Aldgate Partners LLP",
    holderPercentage: "34.0",
    secondHolderName: "Pemberton Trust",
    secondHolderPercentage: "18.0",
    floatPercentage: "45.0",
    headline: "Framework agreement signed for pump refurbishment",
    announcementSummary:
      "a three-year framework agreement covering pump refurbishment for water utilities",
    quote: "This award reflects years of patient work with the utilities",
  },
  {
    companyCity: "Malmö",
    segmentName: "industrial holdings",
    projectName: "Vinter",
    supplierName: "Nordkalk",
    chairName: "L. Bergström",
    directorName: "E. Lund",
    bankName: "Svenska Handels",
    holderName: "Bergslagen Invest AB",
    holderPercentage: "41.5",
    secondHolderName: "Falun Förvaltning",
    secondHolderPercentage: "12.0",
    floatPercentage: "43.5",
    headline: "Second production cell enters service",
    announcementSummary: "the start of production at a second machining cell",
    quote: "The second cell gives us the capacity our order book needs",
  },
  {
    companyCity: "Duisburg",
    segmentName: "specialty materials",
    projectName: "Rheinfeld",
    supplierName: "Sasol Wax",
    chairName: "M. Voss",
    directorName: "H. Krause",
    bankName: "Rheinische Bank",
    holderName: "Hanseatic Capital",
    holderPercentage: "28.0",
    secondHolderName: "Westfalen Beteiligung",
    secondHolderPercentage: "24.0",
    floatPercentage: "45.0",
    headline: "Long-term supply agreement extended to 2031",
    announcementSummary: "the extension of a long-term supply agreement with an existing customer",
    quote: "Our customers value continuity, and so do we",
  },
  {
    companyCity: "Rotterdam",
    segmentName: "logistics",
    projectName: "Maasvlakte",
    supplierName: "Van Oord",
    chairName: "J. de Wit",
    directorName: "T. Jansen",
    bankName: "Amstel Krediet",
    holderName: "Zuiderzee Beheer",
    holderPercentage: "46.0",
    secondHolderName: "Ijssel Holding",
    secondHolderPercentage: "15.5",
    floatPercentage: "35.5",
    headline: "Terminal automation programme reaches milestone",
    announcementSummary: "the completion of the second phase of its terminal automation programme",
    quote: "Automation is about reliability first and cost second",
  },
  {
    companyCity: "Cork",
    segmentName: "food production",
    projectName: "Blackwater",
    supplierName: "Glanbia",
    chairName: "S. Kavanagh",
    directorName: "D. Byrne",
    bankName: "Liffey Bank",
    holderName: "Shannon Equity",
    holderPercentage: "22.5",
    secondHolderName: "Corrib Nominees",
    secondHolderPercentage: "20.0",
    floatPercentage: "54.5",
    headline: "Chilled distribution centre opens",
    announcementSummary:
      "the opening of a chilled distribution centre serving the south of the country",
    quote: "Chilled capacity has been our constraint for two seasons",
  },
  {
    companyCity: "Lyon",
    segmentName: "precision components",
    projectName: "Ardèche",
    supplierName: "Aubert & Duval",
    chairName: "C. Marchand",
    directorName: "R. Fontaine",
    bankName: "Banque du Rhône",
    holderName: "Dauphiné Gestion",
    holderPercentage: "38.0",
    secondHolderName: "Savoie Participations",
    secondHolderPercentage: "17.0",
    floatPercentage: "42.0",
    headline: "New metrology laboratory commissioned",
    announcementSummary: "the commissioning of a metrology laboratory at its main site",
    quote: "Measurement is where quality is won or lost",
  },
];

/** Fill in the figures a set of documents needs, so one profile renders a whole company. */
function business(profile: Business, name: string, jurisdiction: string, index: number): Business {
  const year = 2024 + (index % 2);
  return {
    ...profile,
    companyName: name,
    companyJurisdiction: jurisdiction,
    custodianName: "Fenwick Nominees Limited",
    registrationNumber: `${1_000_000 + index * 37_211}`,
    reportYear: `${year}`,
    asOf: `${year}-09-30`,
    previousExtract: `${year - 1}-09-30`,
    meetingDate: `${year}-06-12`,
    previousMeetingDate: `${year}-03-06`,
    memoDate: `${year}-10-21`,
    releaseDate: `${year}-11-04`,
    periodEnd: `${year}-12-31`,
    facilityMaturity: `${year + 2}-04-30`,
    paymentDate: `${year}-11-18`,
    segmentRevenue: `EUR ${112 + index * 9}.4m`,
    priorRevenue: `EUR ${104 + index * 8}.1m`,
    operatingProfit: `EUR ${9 + index}.7m`,
    exceptionalCharge: `EUR ${1 + (index % 3)}.2m`,
    netDebt: `EUR ${24 + index * 3}.0m`,
    facilityAmount: `EUR ${60 + index * 5}.0m`,
    cashBalance: `EUR ${18 + index * 2}.6m`,
    capitalExpenditure: `EUR ${12 + index}.5m`,
    capitalSpent: `EUR ${7 + index}.9m`,
    orderIntake: `EUR ${31 + index * 2}.8m`,
    orderPlan: `EUR ${29 + index * 2}.0m`,
    employeeCount: `${420 + index * 65}`,
    paymentReference: `PAY-${year}-${40_118 + index * 313}`,
    paymentAmount: `EUR ${340 + index * 27},500.00`,
    payerName: name,
    payeeName: profile["supplierName"] ?? "Ardan Steel",
  };
}

const businesses: readonly Business[] = distractors.parties.map((party, index) =>
  business(profiles[index % profiles.length] ?? {}, party.fullName, party.jurisdiction, index),
);

const templates = {
  register: new URL("../../data/haystack/templates/shareholder-register.txt", import.meta.url),
  minutes: new URL("../../data/haystack/templates/board-minutes.txt", import.meta.url),
  release: new URL("../../data/haystack/templates/press-release.txt", import.meta.url),
  report: new URL("../../data/haystack/templates/annual-report-section.txt", import.meta.url),
  payment: new URL("../../data/haystack/templates/payment-advice.txt", import.meta.url),
  inspection: new URL("../../data/haystack/templates/site-inspection.txt", import.meta.url),
};

/** Several sections of one company's report, joined into a document long enough to chunk. */
const reportSections = [
  "Operating review",
  "Financial review",
  "Segment performance",
  "Sustainability and people",
  "Directors' report",
];

/** Distinct paperwork for each link: no two certificates share a number, holding or date. */
function certificateDetails(index: number): Readonly<Record<string, string>> {
  const shares = [51_000, 64_500, 77_000, 82_400, 58_300, 91_200, 69_800];
  const currencies = ["EUR", "EUR", "CHF", "EUR", "EUR", "EUR", "CHF"];
  const issued = 100_000;
  const held = shares[index % shares.length] ?? 77_000;
  return {
    certificateNumber: `${1_204 + index * 617}`,
    registrationNumber: `${480_912 + index * 21_377}`,
    shareCount: held.toLocaleString("en"),
    shareCurrency: currencies[index % currencies.length] ?? "EUR",
    percentage: ((held / issued) * 100).toFixed(1),
    issuedShares: issued.toLocaleString("en"),
    firstShare: `${1 + index * 137}`,
    lastShare: `${held + index * 137}`,
    issueDate: `20${19 + index}-0${1 + (index % 8)}-1${index % 9}`,
    articleNumber: `${6 + (index % 5)}`,
  };
}

/** The record that each link in the chain, and each fact the rules need, comes from. */
const ofac = {
  designation: new URL(
    "../../data/ofac/templates/sanctioned-person-designation.txt",
    import.meta.url,
  ),
  removal: new URL(
    "../../data/ofac/templates/sanctioned-person-historical-removal.txt",
    import.meta.url,
  ),
  payment: new URL("../../data/ofac/templates/party-to-transaction-payment.txt", import.meta.url),
  classification: new URL(
    "../../data/ofac/templates/transaction-in-industry-classification.txt",
    import.meta.url,
  ),
  discussion: new URL(
    "../../data/ofac/templates/transaction-in-industry-discussion.txt",
    import.meta.url,
  ),
  certificate: new URL("../../data/haystack/templates/share-certificate.txt", import.meta.url),
  register: new URL(
    "../../data/ofac/templates/owns-majority-historical-register.txt",
    import.meta.url,
  ),
};

/**
 * The corpus: one share certificate per ownership link, the listing, the payment and the
 * industry classification, two stale records that contradict current ones, and unrelated
 * paperwork from six other businesses. Nothing but the certificates establishes the chain,
 * so the conclusion needs every link.
 */
export function createHaystackCorpus(base: ReturnType<typeof createHaystackKB>): {
  corpus: Corpus<ScenarioMetadata>;
  targets: readonly GroundAtom[];
} {
  const { entities, predicates } = base;
  const { volkov, ural, transaction, agriculture } = entities;
  const ownership = ownershipLinks(entities).map((link) => ({
    ...link,
    atom: predicates.ownsMajority({ owner: link.owner, entity: link.entity }),
  }));
  const listing = predicates.sanctioned({ party: volkov });
  const involvement = predicates.partyToTransaction({ party: ural, transaction });
  const industry = predicates.transactionInIndustry({ transaction, industry: agriculture });
  const targets = [listing, involvement, industry, ...ownership.map(({ atom }) => atom)];

  const document = (
    documentId: string,
    file: URL,
    variables: Readonly<Record<string, string>>,
    evidence: ScenarioMetadata["evidence"],
    kind: ScenarioMetadata["kind"] = "evidence",
  ): DocumentInput<ScenarioMetadata> => ({
    documentId,
    text: renderTemplate(file, { ...dateVariables, ...variables }),
    metadata: {
      kind,
      scope: "specific",
      evidence: [...evidence],
      irrelevantTo: targets.filter((atom) => !evidence.some((literal) => literal.atom === atom)),
    },
  });

  const parties = (owner: Party, entity: Party): Readonly<Record<string, string>> => ({
    ownerName: owner.fullName,
    ownerJurisdiction: owner.jurisdiction,
    entityName: entity.fullName,
    entityJurisdiction: entity.jurisdiction,
    transactionId: transaction.id,
    industryName: agriculture.id,
  });

  const corpus = new Corpus<ScenarioMetadata>();
  corpus.add([
    document("haystack/sdn-listing", ofac.designation, parties(volkov, ural), [
      { sign: "+", atom: listing },
    ]),
    document("haystack/sdn-removal", ofac.removal, parties(volkov, ural), [], "near-miss"),
    document("haystack/wire-transfer", ofac.payment, parties(volkov, ural), [
      { sign: "+", atom: involvement },
    ]),
    document("haystack/industry-classification", ofac.classification, parties(volkov, ural), [
      { sign: "+", atom: industry },
    ]),
    document(
      "haystack/industry-discussion",
      ofac.discussion,
      parties(volkov, ural),
      [],
      "near-miss",
    ),
    // Each link's paperwork is its own: distinct certificate, registration, holding and date,
    // so no two certificates can be mistaken for one another.
    ...ownership.map(({ owner, entity, atom }, index) =>
      document(
        `haystack/share-certificate-${index + 1}`,
        ofac.certificate,
        { ...parties(owner, entity), ...certificateDetails(index) },
        [{ sign: "+", atom }],
      ),
    ),
    // A superseded register for one link in the middle, to be settled like the others.
    ...ownership
      .slice(1, 2)
      .map(({ owner, entity }) =>
        document(
          "haystack/share-register-superseded",
          ofac.register,
          parties(owner, entity),
          [],
          "near-miss",
        ),
      ),
    ...sharedNeutralDocuments(targets).map((createDocument) => createDocument()),
  ]);

  const background = (id: string, text: string): DocumentInput<ScenarioMetadata> => ({
    documentId: id,
    text,
    metadata: { kind: "neutral", scope: "specific", evidence: [], irrelevantTo: targets },
  });
  corpus.add(
    businesses.flatMap((company, index) => {
      const prefix = `haystack/company-${index + 1}`;
      const report = reportSections
        .map((sectionTitle, section) =>
          renderTemplate(templates.report, {
            ...company,
            sectionTitle,
            sectionNumber: `${section + 1}`,
          }),
        )
        .join("\n\n");
      return [
        background(`${prefix}/annual-report`, report),
        background(`${prefix}/shareholder-register`, renderTemplate(templates.register, company)),
        background(`${prefix}/board-minutes`, renderTemplate(templates.minutes, company)),
        background(`${prefix}/press-release`, renderTemplate(templates.release, company)),
        background(`${prefix}/payment-advice`, renderTemplate(templates.payment, company)),
        background(`${prefix}/site-inspection`, renderTemplate(templates.inspection, company)),
      ];
    }),
  );
  return { corpus, targets };
}
