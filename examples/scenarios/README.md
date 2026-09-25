# Scenario factories

```ts
import createJ1Scenario from "@factbag/scenarios/j1";
import createOfacScenario from "@factbag/scenarios/ofac";

const scenario = createJ1Scenario("contradictory");
const { kb, corpus, targets, expected, predicates } = scenario;

// Select documents by broad classification or native predicate identity.
const evidence = corpus.filter(({ metadata }) => metadata.kind === "evidence");
const tenureDocuments = corpus.filter(
  ({ metadata }) =>
    metadata.evidence?.some(({ atom }) => atom.predicate === predicates.tenureTrack) ?? false,
);

const sanctions = createOfacScenario();
```

## Files and bindings

Each domain has a flat document directory. Only templates get a subdirectory:

```text
data/
  shared/
    printer-maintenance.txt
  j1/
    lab-inventory-notice.txt
    templates/
      tenure-track-appointment.txt
      tenure-track-visiting-appointment.txt
      tenure-track-conflicting-record.txt
      tenure-track-other-applicant.txt
  ofac/
    templates/
      sanctioned-person-designation.txt
      sanctioned-person-historical-removal.txt
      owns-majority-share-certificate.txt
      ...
```

Code explicitly binds every document to a file. No directory is scanned,
and filenames do not determine evidence labels. Descriptive filenames help authors;
the corpus uses neutral document IDs so those labels do not enter model requests.

Each scenario directory has three files: `kb.ts` builds the knowledge base (entities,
predicates, rules and stipulated facts), `corpus.ts` builds the labeled corpus for a
case, and `scenario.ts` combines them with the expected answers. The scenario exposes
the finished `corpus`, not the document definitions behind it.

A conflicting document has positive and negative `Literal` annotations for the same
native atom. A document can annotate multiple predicates.

`renderTemplate(fileURL, variables)` reads one explicitly bound UTF-8 template and
substitutes `{{variable}}` placeholders with supplied strings or numbers. It throws
for missing variables or expression-like placeholders. Substitution is literal and
single-pass: no JavaScript execution, object-path lookup, or recursive interpolation.

Entity names come from the same native entities used in the annotations. Use
templates for meaningful variable data, such as parties and effective dates. Fixed
background documents are plain text, read by their explicitly bound factories.
The printer notice and lab inventory notice have no artificial parameters.

Documents should read like ordinary correspondence and records. Do not tell the
reader that a passage is a near miss, irrelevant, or contradictory. Those judgments
belong in annotations; disagreement should arise naturally from the source claims.

## Contract

Factories take case selection and return fresh `KnowledgeBase` and typed `Corpus`
instances, grounded `targets`, and independently authored expected query values.
They also expose named predicates and entities. Repeated calls use
stable document/entity IDs and text, but independent stores, predicates, entities,
and annotation arrays. No requests or model calls occur during construction.

Documents use the existing `DocumentInput<ScenarioMetadata>` type. Metadata adds
only scenario-specific organization:

- `kind`: `evidence`, `neutral`, or `near-miss`.
- `scope`: `shared` or `specific`.
- `evidence`: existing core `Literal` values (`sign` and native `atom`). Positive
  and negative annotations link directly to the factory's predicates and entities.
- `irrelevantTo`: existing grounded atoms explicitly reviewed as unsupported by
  this document. Neutrality is scoped to these targets, not universal.

Opposite signs for the same proposition constitute contradictory evidence, either
within one document or across documents. There is no second proposition format,
predicate-name lookup, or independent contradiction flag.

Every shipped document is completely annotated **for its scenario's `targets`**:
each target appears in `evidence` or `irrelevantTo`. That does not label every
possible atom in the KB. Missing annotations in new documents mean unreviewed,
not neutral. The factory tests check coverage and disjointness.

Annotations are expected evidence, **not accepted facts in the base KB**. Tests can
apply them to a fork for reasoning checks. Classifier evals should compare actual
extraction against them, and separately compare queries against `expected`.
Expectations describe the complete factory corpus; selecting a subset may change
the correct answers.

Metadata preserves native references and is only shallow-frozen by the corpus.
Treat annotations and referenced domain objects as read-only during a run.
No serialization is required. Keep labels out of model inputs; mocks and execution
configuration belong to consumers, not these factories.

## Initial cases and provenance

### J-1

`createJ1Scenario("positive" | "negative" | "contradictory" | "contradictory-document" | "neutral")`
defaults to `positive`. It models only the tenure-track disqualification ground
under §62.20(d)(1), not the full J-1 eligibility rules. Both source emails are used
in the `contradictory` case. The `contradictory-document` case uses one forwarded
appointment thread with inconsistent HR and department accounts. A negative
tenure-track finding does not establish overall eligibility.

The positive and negative appointment templates were adapted from
`temp/j1_visa/fragments/`, recovered from expert-systems commit
`682b7033d863dd36a12647d4fb8806678f508b65`. The lab inventory notice is unchanged.
The forwarded thread and another applicant's campus-visit email are authored
fixtures. The raw imports remain in `temp/`.

### OFAC

`createOfacScenario()` uses seven individually bound templates adapted from
`temp/ofac_sanctions/runs/20260405_192716_ofac_sanctions/scenarios/depth_1.txt`.
It does not parse the combined benchmark file or include its instructions as documents.

The case's calendar dates are fixed constants in `src/ofac/dates.ts`: the review
date (`asOf`, **2025-01-20**), original designation, removal, redesignation, list
publication, historical and current ownership records, classification discussion,
final classification, and payment. Templates and temporal predicate descriptions
read them from there. The near-miss labels depend on their ordering, so changing a
date can change the ground truth.

This is the source's **abstract sanctions benchmark**, including its stipulated
agriculture sanctions and control-based blocking rules, not a complete or accurate
implementation of all OFAC law. The ownership and control rules are generic, as in the
source: blocking propagates down any edge, to any depth. This case exercises a single
Volkov → Ural edge; the haystack case runs the same rules over a seven-link chain.
Four source documents establish listing, transaction involvement,
industry classification, and majority ownership. Older records and tentative
classification discussions are near misses relative to the fixed dates.

### Haystack

`createHaystackScenario()` stretches the sanctions question and buries it. The ownership
chain runs through six intermediaries — Volkov → Harlow → Orpheus → Castellan → Ardglass →
Piave → Valmer → Ural — so seven share certificates, each its own document, have to be read
before the payer is blocked. Drop one and the prohibition no longer follows. Eighteen
expectations cover the links, the blocked parties along the chain, and the prohibition.

Around it sit four unrelated businesses, each contributing a shareholder register, board
minutes, a press release, a payment advice, a site inspection report and a five-section
annual report long enough to span several chunks: 38 documents, about 101,000 characters.
Ten more parties, two transactions and two industries are registered, which widens every
candidate domain (`owns_majority` alone enumerates 272 candidates once self-pairs are
dropped).

The noise is ordinary corporate paperwork. None of it mentions sanctions, listings or the
transaction under review, and the factory test asserts as much, so any evidence found there
is spurious. The shareholdings in it are real data: a register showing a 34% holder does deny
`owns_majority` for that pair.

Two notes for anyone editing this scenario:

- **The chain rules are generic**, shared with the OFAC case: blocking propagates down any
  ownership or control edge, to any depth. Each link still needs its own evidence.
- **Names carry meaning to a model.** An intermediary called "Nominee Services" reads as
  holding shares for someone else and measurably weakens an otherwise identical share
  certificate, so the intermediaries are plain holding companies.

### Shared background

Both factories include an authored, synthetic printer-maintenance notice with
scenario-specific neutral annotations. J-1 additionally includes its original
scenario-specific neutral fragment. Text is shared, but the target references are
fresh for each factory invocation.

Document IDs name the scenario and then the record: `ofac/sdn-listing`,
`haystack/share-certificate-3`, `haystack/company-2/board-minutes`. The OFAC and haystack
cases share the slugs for the records they have in common, so the same document is
recognisable in both. J-1 keeps neutral `j1/document-N` identifiers rather than the source
directories' `qualifying`/`disqualifying` labels. IDs stay out of model requests either way.

## Adding a scenario

1. In `kb.ts`, create the entities, predicates, rules, and stipulated base facts.
2. In `corpus.ts`, name the grounded extraction targets and explicitly bind each
   document to a descriptive file. Pass entity values and relevant dates to templates.
3. Include relevant shared and domain-specific background; label it for those targets.
4. Write expected query outcomes independently of the implementation under test.
5. Test annotation coverage, reference identity, fresh instances, and reasoning on
   a fork populated with the expected evidence.
6. Consume the scenario in an example or eval, keeping model responses and scheduling there.
