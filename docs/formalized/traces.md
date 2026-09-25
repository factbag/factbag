# Traces

The final value is lattice-valued.

The investigation trace is multi-valued and provenance-preserving.

Example:

```txt
⊤ ∨ ! = ⊤
```

But the trace may still record:

```txt
H = ⊤ via R₁
H = ! via R₂
```

So the system may report:

```txt
approved = ⊤
```

while still showing:

```txt
unresolved conflict exists in alternative path
```
