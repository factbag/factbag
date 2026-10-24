# Disjunction binding correctness

This bundle includes the original environment fix (`1cc875a`) together with both follow-up corrections (`2f663b5`, `41ab0cf`) and their declarative regression examples. It builds on the bound-value constraint fix (`afb79b2`).

A disjunction cannot borrow truth from a different variable assignment. Arithmetic temporaries must not invalidate an otherwise valid branch. Branches that extend an environment after a failed path must be evaluated in that extended environment rather than triggering an assertion.

All three examples run as ordinary passing tests. No historical baseline branch or SARA-specific production code is included. Internal unit tests from the three fixes remain alongside the DSL examples.

Validation includes the full core suite, repository formatting, lint and typecheck, and pre-push API-report checks. The standalone reproductions were also checked before and after their respective original fixes.
