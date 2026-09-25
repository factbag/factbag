# Judgments

A rule body evaluates by conjunction.

For a body:

```txt
Body = A₁ ∧ A₂ ∧ ... ∧ Aₙ
```

The body value is:

```txt
Body = min(A₁, A₂, ..., Aₙ)
```

The weakest premise controls the strength of a conjunctive body.

## If Rules

An `if` rule is a sufficient condition:

```txt
H ← Body
```

Its contribution to `H` is:

```txt
contribute_if(⊤) = ⊤
contribute_if(!) = !
contribute_if(?) = ?
contribute_if(⊥) = ?
```

A false sufficient-condition body does not reject the head.

## Iff Rules

An `iff` rule is a definitional or criterion rule:

```txt
H ↔ Body
```

Its contribution to `H` is:

```txt
contribute_iff(v) = v
```

A false criterion body rejects the head.

## Multiple Rules

Multiple rule contributions evaluate by disjunction.

For contributions:

```txt
C₁, C₂, ..., Cₙ
```

The value of `H` is:

```txt
H = C₁ ∨ C₂ ∨ ... ∨ Cₙ
```

Equivalently:

```txt
H = max(C₁, C₂, ..., Cₙ)
```

The strongest route controls the final value.
