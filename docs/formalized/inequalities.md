# Inequalities

For a finite count range:

```txt
R = [l, u]
u = l + C + U

C = conflicted candidates
U = unknown candidates
```

Inequalities over finite ranges are:

```txt
[l, u] ≥ n = ⊤  if l ≥ n
[l, u] ≥ n = ⊥  if u < n
[l, u] ≥ n = !  if l < n ≤ l + C
[l, u] ≥ n = ?  otherwise, if l < n ≤ u

[l, u] > n = ⊤  if l > n
[l, u] > n = ⊥  if u ≤ n
[l, u] > n = !  if l ≤ n < l + C
[l, u] > n = ?  otherwise, if l ≤ n < u

[l, u] ≤ n = ⊤  if u ≤ n
[l, u] ≤ n = ⊥  if l > n
[l, u] ≤ n = !  if l ≤ n < l + C
[l, u] ≤ n = ?  otherwise, if l ≤ n < u

[l, u] < n = ⊤  if u < n
[l, u] < n = ⊥  if l ≥ n
[l, u] < n = !  if l < n ≤ l + C
[l, u] < n = ?  otherwise, if l < n ≤ u
```

Dual pairs:

```txt
[l, u] ≥ n  pairs with  [l, u] < n
[l, u] > n  pairs with  [l, u] ≤ n
```

Conflicted support dominates only when it alone can change the inequality result.

```txt
[l, u] ≥ n and [l, u] < n use:  l < n ≤ l + C
[l, u] > n and [l, u] ≤ n use:  l ≤ n < l + C
```

Open-world count ranges have unbounded upper range:

```txt
R = [l, ∞]
```

The same lower-bound definite rules apply. Upper-bound definite truth does not apply.

```txt
[l, ∞] ≥ n = ⊤  if l ≥ n
[l, ∞] > n = ⊤  if l > n

[l, ∞] ≤ n = ⊥  if l > n
[l, ∞] < n = ⊥  if l ≥ n
```

Otherwise open-world uncertainty contributes `?`.

## Mixed Uncertainty

Uncertainty composes through the value hierarchy:

```txt
⊥ < ? < ! < ⊤
```

Alternative ways to cross use disjunction:

```txt
! ∨ ? = !
```

Jointly required uncertainty uses conjunction:

```txt
! ∧ ? = ?
```

Example:

```txt
[2, 4] ≥ 3 with C = 1, U = 1

2 + C ≥ 3
therefore !
```

Example:

```txt
[2, 4] ≤ 3 with C = 1, U = 1

l = 2
l + C = 3
l + C + U = 4

u > 3, so not ⊤
l ≤ 3, so not ⊥

conflicted support alone does not refute:
l + C = 3

refutation requires unknown support:
l + C + U = 4

therefore ?
```
