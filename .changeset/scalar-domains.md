---
"factbag": minor
---

The Jev classifier can classify `Date`, `Number` and `String` fields when the request config supplies candidate values for them in `domains`, by constructor or by field name, for example the dates a passage mentions for its `Date` fields and the years it names for its `year` fields. Such fields were rejected as open-ended before, which forced an entity stand-in for every date and a translation step before rules could compare it. Dates are sent as ISO strings; evidence carries the original values. A scalar field with no supplied values is still rejected.
