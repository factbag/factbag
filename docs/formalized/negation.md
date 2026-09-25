# Negation

Explicit negation:

```txt
¬P = explicit negative support
```

Explicit negation maps values as:

```txt
¬⊤ = ⊥
¬⊥ = ⊤
¬? = ?
¬! = !
```

Explicit negation is involutive:

```txt
¬¬A = A
```

Negation-as-failure:

```txt
~P = negation-as-failure
```

Closed-world predicates denote complete relations for the relevant scope.

For a positive atom over a closed-world predicate, absence of accepted matching evidence is negative support:

```txt
closed P missing = ⊥
```

For an open-world predicate, absence of accepted matching evidence remains unknown:

```txt
open P missing = ?
```

Negation-as-failure applies only to closed-world predicates.

For open-world predicates, negation-as-failure is invalid.

For closed-world predicates, negation-as-failure maps values as:

```txt
~⊤ = ⊥
~⊥ = ⊤
~? = ⊤
~! = !
```
