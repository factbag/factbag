# Operators

Conjunction:

```txt
A ∧ B = min(A, B)
```

Disjunction:

```txt
A ∨ B = max(A, B)
```

## Commutativity

```txt
A ∧ B = B ∧ A
A ∨ B = B ∨ A
```

## Associativity

```txt
(A ∧ B) ∧ C = A ∧ (B ∧ C)
(A ∨ B) ∨ C = A ∨ (B ∨ C)
```

## Idempotence

```txt
A ∧ A = A
A ∨ A = A
```

## Absorption

```txt
A ∧ (A ∨ B) = A
A ∨ (A ∧ B) = A
```

## Monotonicity

If:

```txt
A ≤ B
```

Then:

```txt
A ∧ C ≤ B ∧ C
A ∨ C ≤ B ∨ C
```

## Distributivity

```txt
A ∧ (B ∨ C) = (A ∧ B) ∨ (A ∧ C)
A ∨ (B ∧ C) = (A ∨ B) ∧ (A ∨ C)
```

## Bounds

```txt
A ∧ ⊥ = ⊥
A ∨ ⊥ = A

A ∧ ⊤ = A
A ∨ ⊤ = ⊤
```

## De Morgan Does Not Hold

Explicit negation does not satisfy De Morgan with this ordering.

Counterexample:

```txt
A = ?
B = !

¬(A ∧ B) = ¬? = ?
¬A ∨ ¬B = ? ∨ ! = !

¬(A ∧ B) ≠ ¬A ∨ ¬B
```
