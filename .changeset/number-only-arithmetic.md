---
"factbag": major
---

Remove bigint support from predicate schemas, numeric expressions, aggregates, and numeric proof ranges. Numeric values now use JavaScript number exclusively, and an empty sum returns 0. The DSL rejects BigInt schemas and bigint operands rather than coercing them.

Migrate BigInt fields to Number and bigint literals to numbers. Division now uses number semantics (fractional results rather than bigint truncation); values outside the safe integer range can lose precision. Date support is unchanged.
