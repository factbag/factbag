import "@typespec/json-schema";
import "./entities/value.tsp";
import "./entities/atom.tsp";
import "./entities/evidence.tsp";
import "./entities/predicate.tsp";
import "./entities/rule.tsp";
import "./entities/program.tsp";
import "./solver/goal.tsp";
import "./solver/judgment.tsp";

using TypeSpec.JsonSchema;

/**
 * The plain data Factbag passes around and persists, and what a solver is
 * given and returns. A shape that can stand where another could carries a `kind`.
 */
@jsonSchema
namespace Factbag.Contracts;
