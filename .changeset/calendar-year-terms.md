---
"factbag": minor
---

Add `firstOfMonth(year, month)`, a date-valued arithmetic term for the first day of a month at UTC midnight, and `yearOf(date)`, a number-valued term for a date's UTC calendar year. Rules can now derive a year's bounds, such as `firstOfMonth(Y, 1)` and `sub(firstOfMonth(add(Y, 1), 1), 86_400_000)`, instead of looking them up in asserted calendar facts. A month outside 1 to 12, or a year that is not a whole number, throws `PrimitiveArithmeticProgrammerError` rather than rolling over. The query API adds `FirstOfMonthGoal` and the `"firstOfMonth"` arithmetic kind.
