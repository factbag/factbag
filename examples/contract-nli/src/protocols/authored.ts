/**
 * Authored predicate descriptions: the one-off, heavyweight work of reading the ContractNLI
 * annotation conventions (train split evidence spans and dev split errors only; the test
 * split was never consulted) and writing down, per hypothesis, what the annotators counted
 * as support, what as contradiction, and what as merely adjacent language. Jev sees these
 * on every request; the cost of writing them is paid once per workflow.
 */
import { predicate } from "@factbag/core/dsl";
import type { PredicateDeclaration } from "@factbag/core/dsl";
import type { Hypothesis } from "../data";
import type { FactbagSetup, Target } from "./factbag";

type Guidance = Readonly<{ description: string; instructions: string }>;

const common =
  "The document is a non-disclosure agreement or an excerpt from one. 'Receiving Party' " +
  "means whichever party receives Confidential Information under it, whatever the document " +
  "calls that party (Recipient, Vendor, Company, Confidant, Receiving Party, each party in a " +
  "mutual agreement). Judge only what the text states. ";

function withCommon(text: string): string {
  return `${common}${text}`;
}

export const guidance: Readonly<Record<string, Guidance>> = {
  "nda-1": {
    description:
      "The agreement makes the Disclosing Party's express identification of information as " +
      "confidential (marking, labelling, a legend, a written designation, or listing in a " +
      "schedule) a condition of its being Confidential Information.",
    instructions: withCommon(
      "ASSERT when Confidential Information is defined as, or limited to, information the " +
        "Disclosing Party marks, labels, stamps, designates, lists, or otherwise identifies as " +
        "confidential, including when oral disclosures must be identified at the time or " +
        "confirmed in writing afterwards, and including 'marked or otherwise designated to show " +
        "expressly or by necessary implication that it is imparted in confidence'. " +
        "DENY only when the agreement expressly covers information that was not identified: " +
        "'whether or not marked', 'regardless of whether identified as confidential', or " +
        "information a reasonable person 'should know' or 'should reasonably understand' is " +
        "confidential even without designation. " +
        "IRRELEVANT when the agreement defines Confidential Information by subject matter or " +
        "by a broad sweep of what is disclosed without saying anything about marking or " +
        "identification, or does not define it at all. A duty to mark copies is not a " +
        "definition and is IRRELEVANT.",
    ),
  },
  "nda-2": {
    description:
      "Confidential Information under the agreement consists only of technical information " +
      "(specifications, designs, drawings, software, data, know-how, scientific or engineering " +
      "material), with no business, financial, or commercial categories.",
    instructions: withCommon(
      "ASSERT when the definition of Confidential Information is confined to technical, " +
        "scientific, engineering, product, software, or data subject matter, or to one named " +
        "technical dataset or system, and names no business or financial category. " +
        "DENY when the definition expressly includes non-technical kinds of information such as " +
        "business, financial, commercial, marketing, sales, pricing, customer, supplier, " +
        "personnel, strategic, legal or 'the fact that the business is for sale'. " +
        "IRRELEVANT when the agreement does not say what kinds of information are covered, for " +
        "example when Confidential Information is defined only as whatever is marked " +
        "confidential, or by reference to an attachment, or is not defined.",
    ),
  },
  "nda-3": {
    description:
      "Confidential Information under the agreement may include information conveyed " +
      "orally or verbally.",
    instructions: withCommon(
      "ASSERT when the definition or scope of Confidential Information includes oral, verbal, " +
        "spoken, or visual disclosures, or information disclosed 'in any form' or 'whether " +
        "written or oral'. " +
        "DENY when Confidential Information is limited to written, tangible, documentary, " +
        "recorded, or marked material, so that oral information is excluded. " +
        "IRRELEVANT when the agreement says nothing about the form in which information is " +
        "disclosed.",
    ),
  },
  "nda-4": {
    description:
      "The Receiving Party may use Confidential Information only for the purpose stated in " +
      "the agreement and for no other purpose.",
    instructions: withCommon(
      "ASSERT when the agreement restricts use of Confidential Information to the Purpose, " +
        "the Transaction, the Project, evaluating a relationship, or performance of the " +
        "agreement, or forbids any other use. A general 'shall not use or disclose' undertaking " +
        "also counts. " +
        "DENY when the Receiving Party is free to use Confidential Information, or residuals " +
        "of it, for any purpose, or may use it for its own business purposes. " +
        "IRRELEVANT when the agreement restricts disclosure only and says nothing about use.",
    ),
  },
  "nda-5": {
    description:
      "The Receiving Party may disclose some Confidential Information to some of its own " +
      "employees, officers, or directors.",
    instructions: withCommon(
      "ASSERT when the agreement permits disclosure to the Receiving Party's employees, " +
        "officers, directors, personnel, staff, or 'Representatives' defined to include " +
        "employees, typically those with a need to know, or requires the Receiving Party to " +
        "restrict disclosure to such employees, or lets it share internally. " +
        "DENY when the Receiving Party may not disclose Confidential Information to any person " +
        "at all, including its employees, or may do so only with the Disclosing Party's prior " +
        "consent or approval in each case. A consent requirement is not permission. " +
        "IRRELEVANT when the agreement does not address disclosure to the Receiving Party's " +
        "own people, for example when the Receiving Party is an individual.",
    ),
  },
  "nda-7": {
    description:
      "The Receiving Party may disclose some Confidential Information to some third parties " +
      "outside its own organisation, such as affiliates, consultants, agents, contractors, " +
      "advisors, lawyers, accountants, or financiers.",
    instructions: withCommon(
      "ASSERT when the agreement permits disclosure to persons outside the Receiving Party " +
        "itself: affiliates, subsidiaries, group companies, consultants, agents, contractors, " +
        "subcontractors, professional or legal or financial advisers, auditors, financiers, " +
        "shareholders, or 'Representatives' defined to include any of these, even if limited " +
        "to those with a need to know. " +
        "DENY when disclosure is confined to the Receiving Party's own employees, officers and " +
        "directors, or when disclosure to any third party is prohibited, including when it is " +
        "prohibited without the Disclosing Party's prior consent or approval. A consent " +
        "requirement is not permission. Disclosure compelled by law is not permission either. " +
        "IRRELEVANT when the agreement does not address to whom Confidential Information may be " +
        "disclosed.",
    ),
  },
  "nda-8": {
    description:
      "If the Receiving Party is required by law, regulation, subpoena, court order, or other " +
      "legal process to disclose Confidential Information, it must notify the Disclosing " +
      "Party.",
    instructions: withCommon(
      "ASSERT when the agreement requires the Receiving Party to give the Disclosing Party " +
        "notice, prompt notice, prior notice, or to inform or consult it, before or upon a " +
        "legally compelled disclosure, including so the Disclosing Party may seek a protective " +
        "order. " +
        "DENY only when the agreement says the Receiving Party may make a legally required " +
        "disclosure without notifying the Disclosing Party. " +
        "IRRELEVANT when the agreement permits legally required disclosure but says nothing " +
        "about notice, or does not address compelled disclosure.",
    ),
  },
  "nda-10": {
    description:
      "The Receiving Party must not disclose the existence of the agreement, the fact that " +
      "the parties are negotiating or have a relationship, or the terms of the agreement.",
    instructions: withCommon(
      "ASSERT when the agreement treats its own existence, terms, subject matter, the " +
        "negotiations, discussions, the Transaction under consideration, or the parties' " +
        "relationship as confidential, or prohibits publicity, press releases, or public " +
        "announcements about the agreement or relationship, or defines Confidential " +
        "Information to include the fact that discussions are taking place. " +
        "DENY when the agreement expressly allows a party to disclose the existence of the " +
        "agreement, the names of the parties, or the nature of the relationship. " +
        "IRRELEVANT when the agreement protects Confidential Information generally but says " +
        "nothing about its own existence, the negotiations, or the relationship.",
    ),
  },
  "nda-11": {
    description:
      "The Receiving Party must not reverse engineer, decompile, disassemble, or analyse " +
      "objects, samples, prototypes, or software that embody the Disclosing Party's " +
      "Confidential Information.",
    instructions: withCommon(
      "ASSERT when the agreement prohibits reverse engineering, reverse compiling, " +
        "decompiling, disassembling, analysing the composition or design of, or attempting to " +
        "duplicate or derive the design of samples, products, prototypes, software, or " +
        "materials, or forbids using the information for the Receiving Party's own design, " +
        "development or manufacturing. " +
        "DENY only when reverse engineering is expressly permitted. " +
        "IRRELEVANT when the agreement contains only general duties not to use or disclose " +
        "Confidential Information, which are not a reverse-engineering prohibition.",
    ),
  },
  "nda-12": {
    description:
      "The Receiving Party may independently develop information similar to Confidential " +
      "Information, typically because independently developed information is excluded from " +
      "the agreement's restrictions.",
    instructions: withCommon(
      "ASSERT when the agreement excludes from Confidential Information, or from its " +
        "restrictions, information the Receiving Party develops or developed independently, " +
        "without use of or reference to the Confidential Information, or acknowledges that " +
        "the Receiving Party may develop similar products or information on its own. " +
        "DENY only when the agreement forbids the Receiving Party from developing similar " +
        "information or products. " +
        "IRRELEVANT when no exclusion for independently developed information appears. Other " +
        "exclusions (public domain, already known, received from a third party) are not this " +
        "one.",
    ),
  },
  "nda-13": {
    description:
      "The Receiving Party may acquire information similar to Confidential Information from " +
      "a third party, typically because information received from a third party is excluded " +
      "from the agreement's restrictions.",
    instructions: withCommon(
      "ASSERT when the agreement excludes from Confidential Information, or from its " +
        "restrictions, information received, obtained, or acquired from a third party or " +
        "another source, usually one not bound by a confidentiality obligation or not in " +
        "breach of one, or information that becomes available from a source other than the " +
        "Disclosing Party. " +
        "DENY only when the agreement forbids obtaining such information from third parties. " +
        "IRRELEVANT when no exclusion for third-party sourced information appears. Other " +
        "exclusions (public domain, already known, independently developed) are not this one.",
    ),
  },
  "nda-15": {
    description:
      "The agreement states that the Receiving Party receives no licence, right, title, or " +
      "interest in the Confidential Information or the Disclosing Party's intellectual " +
      "property; ownership stays with the Disclosing Party.",
    instructions: withCommon(
      "ASSERT when the agreement says that no licence or right is granted or implied, that " +
        "nothing in it shall be construed as granting any right, that the Disclosing Party " +
        "reserves or retains all rights, that Confidential Information remains the Disclosing " +
        "Party's property, or that no rights are granted beyond the Permitted Purpose. Such " +
        "statements SUPPORT this predicate; they do not contradict it. A limited right to use " +
        "the information for the Purpose, or to copy it for the Purpose, is consistent with " +
        "this predicate and still ASSERTs it when the no-licence language is present. " +
        "DENY only when the agreement affirmatively grants the Receiving Party a licence, " +
        "ownership, or other rights in the Confidential Information or intellectual property. " +
        "IRRELEVANT when the agreement says nothing about licences, rights, title, or " +
        "ownership of the Confidential Information.",
    ),
  },
  "nda-16": {
    description:
      "Upon termination or expiry of the agreement, or completion of its purpose, the " +
      "Receiving Party must return or destroy some Confidential Information.",
    instructions: withCommon(
      "ASSERT when a return or destruction obligation is triggered by termination, " +
        "expiration, or conclusion of the agreement, the contract, the project, the " +
        "engagement, the meeting, or the business relationship, by completion of the purpose, " +
        "or by a decision not to proceed with the transaction, whether or not it is also " +
        "triggered by request. " +
        "DENY only when the agreement states that the Receiving Party need not, or may choose " +
        "not to, return or destroy Confidential Information at termination. " +
        "IRRELEVANT when return or destruction is required only upon the Disclosing Party's " +
        "request, demand, or instruction, with no termination, expiry, or completion trigger, " +
        "or when the agreement has no return or destruction clause. A clause saying the " +
        "agreement may be terminated is not a return obligation.",
    ),
  },
  "nda-17": {
    description:
      "The Receiving Party is permitted to make copies of some Confidential Information in " +
      "some circumstances.",
    instructions: withCommon(
      "ASSERT when the agreement affirmatively permits copying: the Receiving Party 'may " +
        "make copies', has 'the right to copy' for the Purpose, may copy as reasonably " +
        "necessary or required for the Purpose, may retain one archival or legal-counsel copy, " +
        "or copies are allowed provided they carry confidentiality notices. A prohibition with " +
        "an exception for copies necessary or required for the Purpose is permission. " +
        "DENY when copying or reproduction is prohibited outright, or is prohibited except " +
        "with the Disclosing Party's prior written consent, permission, or approval. A " +
        "consent requirement is not permission. " +
        "IRRELEVANT when copies are merely mentioned: a duty to return or destroy 'all copies', " +
        "a statement that copies are Confidential Information or the Disclosing Party's " +
        "property, a duty to mark copies, or references to copies of the agreement itself. " +
        "None of these permits or forbids copying.",
    ),
  },
  "nda-18": {
    description:
      "The Receiving Party must not solicit, hire, or recruit some of the Disclosing Party's " +
      "employees, contractors, or representatives, or must not circumvent the Disclosing " +
      "Party by contacting its people.",
    instructions: withCommon(
      "ASSERT when the agreement contains a non-solicitation, no-hire, or non-circumvention " +
        "undertaking covering the Disclosing Party's employees, officers, consultants, " +
        "contractors, customers, suppliers, or other representatives, for any period. " +
        "DENY only when solicitation or hiring of the Disclosing Party's people is expressly " +
        "permitted. " +
        "IRRELEVANT when the agreement does not address solicitation, hiring, or " +
        "circumvention. A statement that nothing in the agreement is a solicitation of an " +
        "offer is not this.",
    ),
  },
  "nda-19": {
    description:
      "Some obligations under the agreement continue after the agreement terminates or " +
      "expires.",
    instructions: withCommon(
      "ASSERT when the agreement says obligations survive termination or expiration, " +
        "continue notwithstanding termination, remain in effect after the agreement ends or " +
        "after the relationship ends, or last for a stated period after termination or " +
        "expiry. " +
        "DENY when the agreement says its obligations end with the agreement, cease on a fixed " +
        "date or after a fixed period measured from signing or disclosure, or expire together " +
        "with the agreement, and nothing survives. " +
        "IRRELEVANT when the agreement sets a term or a confidentiality period without saying " +
        "what happens to obligations after termination, or does not address termination at " +
        "all. A return-of-materials duty triggered by termination is not survival.",
    ),
  },
  "nda-20": {
    description:
      "The Receiving Party is allowed to keep some Confidential Information even after it " +
      "has returned or destroyed the rest.",
    instructions: withCommon(
      "ASSERT when the agreement allows the Receiving Party to retain some Confidential " +
        "Information: one archival or legal-counsel copy, copies required by law, regulation, " +
        "or internal compliance or record-keeping policy, copies on routine backup systems, " +
        "material that is infeasible to return, notes or analyses it prepared, or information " +
        "retained in unaided memory (residuals). " +
        "DENY only when the agreement expressly excludes retention: the Receiving Party 'shall " +
        "not retain any copies', must destroy or erase every copy including electronic copies " +
        "and expunge them from computers, or must certify that nothing has been kept. " +
        "IRRELEVANT for an ordinary return-or-destroy clause, even one covering 'all copies', " +
        "that does not explicitly address whether anything may be kept, and when there is no " +
        "return or destruction clause.",
    ),
  },
};

/** One predicate per hypothesis, carrying its authored guidance to Jev. */
export const authored: FactbagSetup = {
  name: "authored",
  build(hypotheses: readonly Hypothesis[]) {
    const writable: PredicateDeclaration[] = [];
    const targets = hypotheses.map((hypothesis): Target => {
      const guide = guidance[hypothesis.id];
      if (guide === undefined) {
        throw new Error(`No authored guidance for ${hypothesis.id}`);
      }
      const declaration = predicate(hypothesis.id.replace("-", "_"), {}, guide);
      writable.push(declaration);
      return { hypothesisId: hypothesis.id, atom: declaration({}) };
    });
    return { writable, targets };
  },
};
