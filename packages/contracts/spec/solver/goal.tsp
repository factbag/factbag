import "@typespec/json-schema";
import "../entities/atom.tsp";
import "../entities/rule.tsp";
import "../entities/value.tsp";

using TypeSpec.JsonSchema;

namespace Factbag.Contracts;

/** A goal that is a single atom. */
model AtomGoal {
  kind: "goal";
  `op`: "atom";
  atom: Atom;
}

model NotGoal {
  kind: "goal";
  `op`: "not";
  goal: Goal;
}

model ConnectiveGoal {
  kind: "goal";
  `op`: ConnectiveKind;
  goals: Goal[];
}

model ExistsGoal {
  kind: "goal";
  `op`: "exists";
  variables: Variable[];
  goal: Goal;
}

model LetGoal {
  kind: "goal";
  `op`: "let";
  variable: Variable;
  value: Term;
  goal: Goal;
}

model ArithmeticGoal {
  kind: "goal";
  `op`: ArithmeticKind;
  bind: Variable;
  left: Term;
  right: Term;
}

model ComparisonGoal {
  kind: "goal";
  `op`: ComparisonKind;
  left: Term;
  right: Term;
}

model SumGoal {
  kind: "goal";
  `op`: "sum";
  bind: Variable;
  value: Term;
  where: Goal;
  completeWhen?: Goal;
}

model CountGoal {
  kind: "goal";
  `op`: "count";
  bind: Variable;
  where: Goal;
  completeWhen?: Goal;
}

/** What a solver evaluates: a rule body in the solver's own normal form. `op` says which. */
@extension(
  "discriminator",
  #{
    propertyName: "op",
    mapping: #{
      atom: "AtomGoal.json",
      not: "NotGoal.json",
      and: "ConnectiveGoal.json",
      or: "ConnectiveGoal.json",
      exists: "ExistsGoal.json",
      let: "LetGoal.json",
      add: "ArithmeticGoal.json",
      `sub`: "ArithmeticGoal.json",
      mul: "ArithmeticGoal.json",
      div: "ArithmeticGoal.json",
      daysBetween: "ArithmeticGoal.json",
      yearsBetween: "ArithmeticGoal.json",
      min: "ArithmeticGoal.json",
      max: "ArithmeticGoal.json",
      roundTo: "ArithmeticGoal.json",
      floorTo: "ArithmeticGoal.json",
      ceilTo: "ArithmeticGoal.json",
      eq: "ComparisonGoal.json",
      neq: "ComparisonGoal.json",
      lt: "ComparisonGoal.json",
      lte: "ComparisonGoal.json",
      gt: "ComparisonGoal.json",
      gte: "ComparisonGoal.json",
      sum: "SumGoal.json",
      count: "CountGoal.json",
    },
  }
)
@oneOf
union Goal {
  AtomGoal,
  NotGoal,
  ConnectiveGoal,
  ExistsGoal,
  LetGoal,
  ArithmeticGoal,
  ComparisonGoal,
  SumGoal,
  CountGoal,
}
