---
"factbag": minor
---

The Jev classifier can classify `Date`, `BigInt`, `Number` and `String` fields when the request config supplies candidate values for them in `domains`, for example the dates a passage mentions. Such fields were rejected as open-ended before, which forced an entity stand-in for every date and a translation step before rules could compare it. Dates are sent as ISO strings and bigints as decimal strings; evidence carries the original values. A scalar field with no supplied values is still rejected.
