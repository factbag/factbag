---
"factbag": minor
---

Add `daysBetween(later, earlier)` and `yearsBetween(later, earlier)` as number-valued arithmetic terms over dates. They count signed UTC calendar days and whole anniversary years, ignoring time of day; February 29 anniversaries fall on March 1 in common years. Numeric subtraction on variables now composes with other numeric operators.
