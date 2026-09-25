# Fix one fact, not the whole answer

You're reviewing a new supplier. Its name doesn't appear on the sanctions list.
Its ownership records are less reassuring: most of its shares are held by a
nominee company. You need to know who those shares really belong to.

You have the register, an ownership agreement, a legal confirmation, and an old
due-diligence memo. The documents disagree.

You could give everything to an AI and ask, “Is this company under sanctions?”
It might produce a good answer. But suppose you notice that it relied on the
old memo rather than the executed agreement. You explain the mistake and ask
it to try again.

Now you have another answer to check. Did it fix that fact? Did it change its
reading of the agreement? Is it still applying the same rule?

The problem isn't just that the model got something wrong. It's that correcting
one fact has reopened the whole decision.

We already avoid this in other kinds of software. In a spreadsheet, we correct
one cell and let the formulas recalculate. In a program, we fix one function
while tests protect the behavior we've checked. The work has a structure. We
can keep the good parts.

**Factbag brings that idea to decisions made from evidence.** We write down the
rules, keep the facts that feed them, and calculate what follows. Some facts
come straight from structured data. AI helps interpret the parts that require
reading. A person can correct a particular interpretation without asking the
model to reconsider everything.

## A company can be covered without appearing on a list

Consider a fictional supplier, Harbor Components. We're screening it as of
September 1, 2026. Three records give us a starting point:

| Record                 | What we know                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| Blocking-list snapshot | Harbor Components is not directly listed.                          |
| The same snapshot      | Oriole Holdings is listed as blocked.                              |
| Ownership register     | Alder Nominees is the registered holder of 60% of Harbor's shares. |

The question is whether Alder holds those shares for Oriole.

This is a real kind of screening problem. Under
[OFAC's 50 Percent Rule](https://ofac.treasury.gov/faqs/401), entities owned
50% or more in the aggregate, directly or indirectly, by blocked persons are
themselves considered blocked. A company need not have its own entry on the list.

For our example, we'll examine one route through that rule: a single majority
stake held by a nominee for a blocked owner. The companies and records are
invented. A complete screening system would also need to handle multiple owners,
indirect chains, and other sanctions restrictions.

The particular argument we're trying to establish looks like this:

```text
Harbor is covered through this ownership arrangement if:
  • Oriole is blocked.
  • Alder holds at least 50% of Harbor.
  • Alder holds that stake for Oriole's beneficial ownership.
  • The arrangement is in force at the screening date.
```

Writing the conditions down matters. A reviewer can inspect the rule before
looking at any individual model answer. The policy doesn't have to be
rediscovered each time we read a document.

## Don't ask a model to read what the computer already knows

The first two conditions don't need AI.

We have a structured list snapshot and a structured ownership record. In this
example, the entities have already been matched to stable identifiers. Ordinary
code checks those identifiers against the list, reads the registered holding,
and compares 60% with the 50% threshold.

Those results enter the knowledge base directly, together with references to
the records and their dates. We don't ask Jev to estimate the percentage,
perform the comparison, or decide whether an ID is in an array.

The remaining conditions are different. An executed agreement may describe
whose benefit the shares are held for. A legal letter may say whether that
arrangement remains effective. Those are statements we need to interpret.

In Factbag, each condition is represented by a **predicate**: a named kind of
fact with fields identifying what it concerns. “A nominee holds shares for an
owner” is a predicate. “Alder holds its stake in Harbor for Oriole” is a specific
claim we can investigate.

The same knowledge base accepts facts from both paths. The source might be an
exact lookup in a structured record or a reading of a paragraph. The rules can
use either, and a reviewer can see where each came from.

At this stage, our ownership conclusion is **unknown**. The supplier's absence
from the list hasn't made the ownership question disappear.

## Ask Jev a question the documents can answer

[Jev](https://typesafe.ai/) is TypeSafe AI's model for making structured judgments.
Here, we use it to ask a smaller question than “is Harbor sanctioned?”:

> Does this passage establish that Alder holds its registered stake in Harbor
> for Oriole's beneficial ownership?

We ask it to distinguish three possibilities:

- **Assert:** the passage supports the claim.
- **Deny:** the passage explicitly contradicts the claim.
- **Irrelevant:** it establishes neither.

The predicate includes guidance about what counts. A shared address or a right
to appoint directors doesn't, by itself, establish ownership. That distinction
is important here: [OFAC's ownership rule is not simply a control test](https://ofac.treasury.gov/faqs/398).

We separately ask whether the arrangement is in force at the screening date.
An old document's existence is not enough to settle that question.

Factbag's corpus library keeps each document and divides it into smaller
passages. Each passage has an ID tied to its position in a particular document
revision. When Jev's reading becomes evidence, that ID stays attached. We can
return to the exact words, with the surrounding text available when needed.

Jev supplies probabilities for assert, deny, and irrelevant. The application
chooses which readings to admit. When assert and deny are close, it can keep
both rather than force a premature choice.

## Let the documents disagree

Suppose the documentary evidence comes back like this. These scores are invented
for the runnable example, not measured Jev results.

| Document                   | Reading                                                | Support for that reading |
| -------------------------- | ------------------------------------------------------ | ------------------------ |
| Executed nominee deed      | Alder holds the stake for Oriole.                      | 0.96                     |
| Current legal confirmation | The arrangement is in force on the screening date.     | 0.87                     |
| Earlier onboarding memo    | Alder holds the stake for its own account, not Oriole. | 0.98                     |

A fourth document announces that Oriole appointed directors to Harbor's board.
It doesn't settle either of our ownership questions, so it adds no evidence for
them. It could matter to a different inquiry; it is not a shortcut to this one.

The earlier memo has the highest score. Should it win?

No. The score concerns Jev's interpretation of the memo. The model can be very
sure that a document says “held for Alder's own account” while the document
itself is outdated.

Factbag retains the positive and negative evidence. The ownership relationship
is now **conflicted**, and so is this argument for treating Harbor as blocked.
We have found a specific question to review.

This gives us four useful states: **true**, **false**, **unknown**, and
**conflicted**. Missing evidence calls for investigation. Opposing evidence
calls for review. Neither has to be disguised as a confident yes or no.

The result includes the facts and rules used to reach it. We can follow the
disputed relationship back to the deed and the memo. This is the calculation
the program performed, rather than an explanation a model composed afterward.

## Correct the interpretation, not the whole case

The analyst checks that the executed deed supersedes the onboarding memo for
this same shareholding. The legal confirmation establishes that the arrangement
covers the screening date. They exclude the memo's denial from the active
evidence and record why.

The rules run again. The required facts now hold: the blocked owner beneficially
owns the 60% stake through the nominee, and the arrangement is effective. Harbor
is therefore treated as blocked under the ownership rule being modeled, even
though it is not directly listed.

We haven't asked Jev to check the sanctions list again. We haven't reimported
the register or changed the percentage. We haven't regenerated our reading of
the legal confirmation. Those accepted facts are still there.

The demo keeps the excluded evidence, its source, and the analyst's reason. A
durable application would save that decision and respect it on later ingestions.
Removing a fact from the current calculation needn't mean forgetting why it
was once included.

This is useful human involvement: a person can inspect one disagreement, change
the part that needs judgment, and see what follows.

## Follow the uncertainty to the conclusion

We can now ask how well this conclusion is supported.

For the demonstration, we take the imported list and register as given inputs.
We assign them a support weight of one for this calculation. That is an explicit
assumption, not a claim that structured data is infallible and not a model
probability.

The documentary readings remain uncertain. One scores `0.96`, the other `0.87`.
We use a simple policy: an argument requiring all its facts is only as strong
as the weakest one.

```text
Ownership argument                         0.87
  Oriole is blocked                        given
  Alder's registered stake is at least 50%  given
  Alder holds the stake for Oriole         0.96
  The arrangement is in force               0.87

min(1, 1, 0.96, 0.87) = 0.87
```

The number tells us where to look next. Improving the reading of the deed to
`0.99` would not strengthen this argument. The weaker part is the evidence that
the arrangement remains in force.

Suppose we add a signed supplemental confirmation. Its support for that same
fact is `0.92`. Our demonstration policy takes the stronger of alternative
pieces of positive evidence:

```text
Arrangement in force: max(0.87, 0.92) = 0.92
Ownership argument:   min(1, 1, 0.96, 0.92) = 0.92
```

We call this a **support score**. It summarizes the argument under an explicit
policy. It does not establish a 92% probability that a legal conclusion is
correct. The runnable example contains a small helper for this calculation;
it leaves conflicted results unscored rather than hide the disagreement behind
one number.

## The same idea can explain reported causes

Consider another question: why did a customer leave?

Our customer database can tell us that Cobalt canceled on September 1. That is
another fact to import directly. An exit interview is different: it says that
outages, failed onboarding, and billing disputes contributed to the decision,
but price did not.

We ask Jev whether each candidate factor is reported to have contributed to
that particular cancellation:

| Factor      | Reading of the interview      | Support |
| ----------- | ----------------------------- | ------- |
| Reliability | Contributed                   | 0.94    |
| Onboarding  | Contributed                   | 0.82    |
| Billing     | Contributed                   | 0.76    |
| Price       | Explicitly did not contribute | 0.91    |
| Competition | Not addressed                 | —       |

Price and competition are different. There is evidence against one; we simply
don't know about the other. Several factors can contribute, so their scores
need not add up to one.

We can write rules that group the facts into explanations. If our definition
of “product breakdown” requires both reliability and onboarding to have
contributed, the same calculation gives it `min(0.94, 0.82) = 0.82`. A separate
explanation based on billing has support of `0.76`.

Set aside the onboarding evidence in a temporary copy of the case, and the
product explanation lacks a required fact. The billing explanation still
holds. The strongest remaining argument scores `0.76`.

That shows how the explanation depends on its evidence. It does not show that
fixing onboarding would reduce churn by six percentage points. We have
analyzed reported contributions, not estimated the effect of an intervention.

## Learn whether the numbers deserve our trust

Eventually, reviewed cases and actual outcomes give us a way to evaluate the
scores. There are two different things we might want to learn.

First, **does Jev read the documents correctly?** Reviewers can label whether a
passage asserts, denies, or says nothing about a claim. Those labels let us
evaluate and adjust the model's three-way probabilities. We should retain the
original assessment alongside any adjusted score.

Second, **can these signals predict an outcome?** We might use support
conversations, onboarding notes, and billing records to predict cancellation
within 30 days. A small statistical model could learn from Jev's assessments,
structured customer data, and actual cancellation outcomes.

These experiments need different labels. Knowing that a customer canceled
doesn't establish that every proposed reason was correct. And an exit interview
collected after cancellation cannot predict that same cancellation.

For a forward-looking prediction, we need the information available at the time
and a complete period in which to observe the outcome. We fit on some customers
and test on other, later cases. If predictions near `0.80` repeatedly come true
only 60% of the time, they are overconfident. A useful calibration improves
that correspondence on cases it hasn't seen.

This layer is still a design idea. Calibrating individual readings would not
automatically calibrate the final min/max score, either. We would check that
separately. The aim is to earn the meaning of a probability through observation,
rather than obtain it by putting a percent sign next to a number.

## Keep the work you've already done

The common thread is a place for progress to accumulate.

The rule is written down. Structured records enter through ordinary code.
Documentary interpretations point back to passages. A disagreement has a
location. A correction has a reason. A score has a calculation.

The AI still does valuable work: interpreting material that doesn't arrive as
neat fields. But its contribution becomes something we can inspect and revise
in pieces. Each correction improves the case instead of starting another round
of answer generation.

That's the experience we're trying to build with Factbag: an answer you can
understand well enough to fix, without losing the parts you've already checked.

---

**Try the examples:** run `pnpm --filter @factbag/jev demo` from the repository
root. The examples use fictional structured records and scripted Jev responses;
they perform no live sanctions screening or model calls. Evidence review,
support scoring, and factor analysis are runnable; calibration is a proposed
next step. See the [example notes](../examples/README.md) for the code and its
scope, or the [package reference](../README.md) for the current API.
