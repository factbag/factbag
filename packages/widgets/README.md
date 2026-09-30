# @factbag/widgets

Interactive teaching widgets for the docs site and blog: the four-valued
lattice, rule evaluation, proof trees, and worked decision scenarios. Each
widget is a self-contained React client component; the ones that show a
verdict compute it by running the real `@factbag/core` solver on every
interaction rather than replaying a script.

This package is private and is not published to npm.

## Widgets

| Component              | Shows                                                  |
| ---------------------- | ------------------------------------------------------ |
| `EvaluationGraph`      | A rule tree evaluated under ∧ or ∨                     |
| `EverydayDecision`     | An everyday AND/OR decision tree                       |
| `TrialEligibilityTree` | A deep eligibility rule with its DSL source            |
| `CountRangeExplorer`   | Counting under uncertainty                             |
| `ProofTreeExplorer`    | A judgment's proof tree and its `explainJudgment` JSON |
| `LiveSolverExplorer`   | A live solve next to the code that ran                 |
| `LiveSolverTree`       | A live solve drawn as a diagram                        |

`ProofTree`, `ValuePill`, `WidgetChrome` and `VERDICT` are exported for hosts
that compose their own pages from the same pieces.

## Hosting

The widgets are styled with Tailwind v4 utilities and expect the host app to
run Tailwind. In the host stylesheet, import the theme fragment and point
`@source` at this package so its classes are generated:

```css
@import "tailwindcss";
@import "@factbag/widgets/theme.css";
@source "../node_modules/@factbag/widgets/src";
```

`theme.css` declares the semantic verdict colours (`positive`, `negative`,
`warning`, `attention`), the `text-2xs` size, and the wire and pop-in
animations. Override the colour tokens to retheme every widget at once.

Widgets render as a framed card by default. Wrap them in
`<WidgetChrome variant="plain">` where the surrounding prose already frames
them, as a docs page does.

Every file carries a `"use client"` directive, so the components can be
registered directly as MDX components in a Next.js app.
