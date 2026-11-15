# @factbag/contracts

The plain data Factbag passes around and persists, and the contract a solver
implements. This private workspace package has no runtime dependencies. It establishes
a JSON boundary for tools and persistence without changing the current DSL,
knowledge base, or solver. Runtime adoption and public exposure are separate changes.

Under `src/`:

- `entities/`: the things a knowledge base is made of, one per file: values,
  entity references, variables, atoms, literals, predicates, rules, the
  program they form, and the knowledge-base document that persists it.
- `solver/`: what a reasoning engine takes and returns: the `Solver`
  interface, and the judgments and goals in its results.
- `shape.ts`: the base every shape extends.

Every shape is JSON data that extends `Shape` (`shape.ts`): its `kind` says
what it is, and no two shapes share a kind. Shapes refer to each other by
name: an atom names its predicate, an entity reference names its class and
id, a variable has a name.

Each file defines a shape with a guard (`isAtom`) and an assert
(`assertIsAtom`). The assert is built from the asserts of its parts, down to
the shared `assert` utility, so every check goes through that one function and
fails with `AssertionError` and nothing more. Guards check shape
only; whether a name refers to anything is for whoever resolves it.

`solver/solver.ts` is the contract a reasoning engine implements:
`Solver.query` and `Solver.queryAll` take a `Program` and an atom and return
`Judgment`s, all of it data from this package. The existing solver has not yet migrated to this interface.

`errors.ts` defines errors for implementations of the contract. These are not
yet the error classes thrown by the current core runtime.

These types describe the proposed shared representation. They do not provide
conversion from the current runtime objects or a serialization API.

`@factbag/contracts/assert` exports the `assert` utility every check here goes
through.
