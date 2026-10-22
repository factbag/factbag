/**
 * The authored configuration with the three hardest hypotheses decomposed: instead of one
 * three-way question, Jev answers two narrower assert-only questions whose combination is a
 * KB rule plus a contra atom. Everything else is identical to `authored`.
 */
import { predicate } from "@factbag/core/dsl";
import type { PredicateDeclaration } from "@factbag/core/dsl";
import type { KnowledgeBase } from "@factbag/core/kb";
import type { Hypothesis } from "../data";
import { guidance } from "./authored";
import type { FactbagSetup, Target } from "./factbag";

const common =
  "The document is a non-disclosure agreement or an excerpt from one. 'Receiving Party' " +
  "means whichever party receives Confidential Information under it, whatever the document " +
  "calls that party. Judge only what the text states. This is a one-sided question: ASSERT " +
  "when the document contains such language, IRRELEVANT when it does not. Never DENY. ";

type Split = Readonly<{
  support: Readonly<{ name: string; description: string; instructions: string }>;
  contra: Readonly<{ name: string; description: string; instructions: string }>;
}>;

const decomposed: Readonly<Record<string, Split>> = {
  "nda-17": {
    support: {
      name: "copying_permitted",
      description:
        "The agreement affirmatively permits the Receiving Party to make copies of some " +
        "Confidential Information in some circumstances.",
      instructions:
        `${common}ASSERT when the Receiving Party 'may make copies', has 'the right to ` +
        "copy', may copy as reasonably necessary or required for the Purpose (including as " +
        "an exception to a no-copying rule), may retain one archival or legal-counsel copy, " +
        "or may make copies provided they carry confidentiality notices. IRRELEVANT when " +
        "copying is prohibited, prohibited except with consent, or when copies are merely " +
        "mentioned (return 'all copies', copies are the Disclosing Party's property, copies " +
        "must be marked, copies of the agreement itself).",
    },
    contra: {
      name: "copying_prohibited",
      description:
        "The agreement prohibits the Receiving Party from copying or reproducing " +
        "Confidential Information, with at most a consent-based exception.",
      instructions:
        `${common}ASSERT when copying, reproduction, or duplication of Confidential ` +
        "Information is prohibited outright, or prohibited except with the Disclosing " +
        "Party's prior written consent, permission, or approval. IRRELEVANT when copying is " +
        "permitted for the Purpose or as necessary, and when copies are merely mentioned in " +
        "return, destruction, ownership, or marking clauses.",
    },
  },
  "nda-19": {
    support: {
      name: "obligations_survive",
      description:
        "Some obligations under the agreement continue after the agreement terminates or " +
        "expires.",
      instructions:
        `${common}ASSERT when obligations survive termination or expiration, continue ` +
        "notwithstanding termination, remain in effect after the agreement or relationship " +
        "ends, or last for a stated period after termination or expiry. IRRELEVANT when the " +
        "agreement only sets a term, a confidentiality period measured from signing or " +
        "disclosure, or a return-of-materials duty at termination, or does not address " +
        "termination.",
    },
    contra: {
      name: "obligations_expire",
      description:
        "The agreement states that its obligations end: with the agreement, on a fixed " +
        "date, or after a fixed period, with nothing surviving.",
      instructions:
        `${common}ASSERT when the agreement says its obligations terminate, expire, cease, ` +
        "or are of no further force on a date, after a period, or together with the " +
        "agreement, and no survival language appears. IRRELEVANT when obligations survive " +
        "termination, when only the agreement's own term is stated, or when termination is " +
        "not addressed.",
    },
  },
  "nda-20": {
    support: {
      name: "retention_permitted",
      description:
        "The Receiving Party is allowed to keep some Confidential Information after " +
        "returning or destroying the rest.",
      instructions:
        `${common}ASSERT when the Receiving Party may retain one archival or legal-counsel ` +
        "copy, copies required by law, regulation, or internal record-keeping or compliance " +
        "policy, copies on routine backup systems, material that is infeasible to return, " +
        "notes or analyses it prepared, or information retained in unaided memory. " +
        "IRRELEVANT for ordinary return-or-destroy clauses and when retention is not " +
        "addressed.",
    },
    contra: {
      name: "retention_excluded",
      description:
        "The agreement expressly forbids the Receiving Party from keeping any Confidential " +
        "Information after return or destruction.",
      instructions:
        `${common}ASSERT when the Receiving Party 'shall not retain any copies', must ` +
        "destroy or erase every copy including electronic copies and expunge them from " +
        "computers, or must certify that nothing has been kept. IRRELEVANT for an ordinary " +
        "return-or-destroy clause, even one covering 'all copies', that does not say nothing " +
        "may be kept, and when retention is permitted or not addressed.",
    },
  },
};

export const rules: FactbagSetup = {
  name: "rules",
  build(hypotheses: readonly Hypothesis[], kb: KnowledgeBase) {
    const writable: PredicateDeclaration[] = [];
    const targets = hypotheses.map((hypothesis): Target => {
      const name = hypothesis.id.replace("-", "_");
      const split = decomposed[hypothesis.id];
      if (split !== undefined) {
        const support = predicate(split.support.name, {}, split.support);
        const contra = predicate(split.contra.name, {}, split.contra);
        const target = predicate(name, {}, { description: hypothesis.text });
        kb.rule(target({})).if(support({}));
        writable.push(support, contra);
        return { hypothesisId: hypothesis.id, atom: target({}), contra: contra({}) };
      }
      const guide = guidance[hypothesis.id];
      if (guide === undefined) {
        throw new Error(`No authored guidance for ${hypothesis.id}`);
      }
      const declaration = predicate(name, {}, guide);
      writable.push(declaration);
      return { hypothesisId: hypothesis.id, atom: declaration({}) };
    });
    return { writable, targets };
  },
};
