# Examples

## Explicit Negative Support

If rule:

```txt
doctor(P) ← passedMedicalSchool(P) ∧ ¬eatenApple(P)
```

Evidence:

```txt
passedMedicalSchool(alice) = ⊤
eatenApple(alice) = ⊥
```

Explicit negation:

```txt
¬eatenApple(alice) = ¬⊥ = ⊤
```

Rule body:

```txt
passedMedicalSchool(alice) ∧ ¬eatenApple(alice)
= ⊤ ∧ ⊤
= min(⊤, ⊤)
= ⊤
```

Contribution and conclusion:

```txt
doctor(alice) = ⊤
```

## Missing Evidence Is Not Explicit Negation

If rule:

```txt
doctor(P) ← passedMedicalSchool(P) ∧ ¬eatenApple(P)
```

Evidence:

```txt
passedMedicalSchool(alice) = ⊤
eatenApple(alice) = ?
```

Explicit negation:

```txt
¬eatenApple(alice) = ¬? = ?
```

Rule body:

```txt
passedMedicalSchool(alice) ∧ ¬eatenApple(alice)
= ⊤ ∧ ?
= min(⊤, ?)
= ?
```

Contribution and conclusion:

```txt
doctor(alice) = ?
```

The missing apple evidence does not satisfy explicit negation.

## Date Window Rule

Iff rule:

```txt
adequatePerformanceStatus(P, T) ↔
  consentDate(P, T, ConsentDate)
  ∧ ecogScore(P, VisitDate, Score)
  ∧ VisitDate ≥ ConsentDate - 14d
  ∧ VisitDate ≤ ConsentDate
  ∧ Score ≤ 1
```

Evidence:

```txt
consentDate(maya, rx204, 2026-03-15) = ⊤
ecogScore(maya, 2026-03-12, 1) = ⊤
```

Normalized arithmetic introduces an internal variable:

```txt
$tmp0 = ConsentDate - 14d
$tmp0 = 2026-03-01
```

Primitive constraints:

```txt
VisitDate ≥ $tmp0
2026-03-12 ≥ 2026-03-01
= ⊤

VisitDate ≤ ConsentDate
2026-03-12 ≤ 2026-03-15
= ⊤

Score ≤ 1
1 ≤ 1
= ⊤
```

Rule body:

```txt
⊤ ∧ ⊤ ∧ ⊤ ∧ ⊤ ∧ ⊤
= min(⊤, ⊤, ⊤, ⊤, ⊤)
= ⊤
```

Conclusion:

```txt
adequatePerformanceStatus(maya, rx204) = ⊤
```

Full body environment:

```txt
P = maya
T = rx204
ConsentDate = 2026-03-15
VisitDate = 2026-03-12
Score = 1
$tmp0 = 2026-03-01
```

If the visit is outside the window:

```txt
VisitDate = 2026-02-10
$tmp0 = 2026-03-01

VisitDate ≥ $tmp0
2026-02-10 ≥ 2026-03-01
= ⊥
```

Then:

```txt
⊤ ∧ ⊤ ∧ ⊥ ∧ ⊤ ∧ ⊤
= min(⊤, ⊤, ⊥, ⊤, ⊤)
= ⊥
```

The `iff` rule contributes `⊥` for that instantiated route.
