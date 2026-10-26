---
"factbag": minor
---

Allow enumerations to hold numbers or dates as well as strings, with one member
type per enumeration. Members must be unique; dates compare by instant and are
copied on construction. NaN and invalid dates are rejected. Enumeration membership
validation at assertion and query time is unchanged.
