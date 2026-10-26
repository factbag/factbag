---
"factbag": minor
---

A new entry point, `factbag/jev/recheck`, settles rule-derived conflicts. The consumer names the conflict as an ordinary derived predicate whose rules say which stated facts cannot hold together; `recheck` derives its ground atoms, traces each proof to the extracted literals it rests on, rereads those literals one by one against the passage they came from with the classifier's three-way question, retracts the ones the rereading no longer supports, and derives again, for a bounded number of rounds. Literals the rereading confirms stay, so a conflict can be reported open; nothing else from a passage is touched, and the input knowledge base is not modified. The passage resolver in `factbag/jev/resolve` is unchanged.
