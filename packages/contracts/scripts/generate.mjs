// Turns the JSON Schema that TypeSpec emits into a dependency-free validator
// module and TypeScript declarations.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { validator } from "@exodus/schemasafe";
import { compile } from "json-schema-to-typescript";

const bundle = JSON.parse(
  readFileSync(new URL("../schema/factbag-contracts.json", import.meta.url), "utf8"),
);
const names = Object.keys(bundle.$defs);
const out = (file) => new URL(`../src/generated/${file}`, import.meta.url);
mkdirSync(new URL("../src/generated/", import.meta.url), { recursive: true });
const banner = "// Generated from spec/main.tsp by scripts/generate.mjs. Do not edit.\n";

// Validators. schemasafe resolves references by absolute id, so each schema
// is registered under a placeholder base that never leaves this script.
const base = "https://factbag.invalid/";
// schemasafe turns a discriminated union into a switch on the tag, which gives
// one precise error instead of one per branch. It wants the tag's values
// written inline in each branch, and the union itself marked as an object
// requiring the tag; neither changes what the schema accepts.
function forValidator(name) {
  const schema = structuredClone(bundle.$defs[name]);
  const tag = schema.discriminator?.propertyName;
  if (tag !== undefined) {
    schema.type = "object";
    schema.required = [tag];
    schema.discriminator.mapping = Object.fromEntries(
      Object.entries(schema.discriminator.mapping).map(([value, ref]) => [value, base + ref]),
    );
    schema.oneOf = schema.oneOf.map(({ $ref }) => ({ $ref: base + $ref }));
  }
  for (const union of Object.values(bundle.$defs)) {
    const unionTag = union.discriminator?.propertyName;
    const property = schema.properties?.[unionTag];
    if (property?.$ref !== undefined && union.oneOf.some(({ $ref }) => $ref === `${name}.json`)) {
      const { enum: values } = bundle.$defs[property.$ref.replace(/\.json$/, "")];
      schema.properties[unionTag] = { enum: values };
    }
  }
  return { ...schema, $id: `${base}${name}.json` };
}
const validators = validator(
  names.map((name) => ({ $ref: `${base}${name}.json` })),
  {
    schemas: Object.fromEntries(names.map((name) => [`${base}${name}.json`, forValidator(name)])),
    multi: true,
    includeErrors: true,
  },
);
writeFileSync(
  out("validators.js"),
  `${banner}const validators = ${validators.toModule()};\n` +
    names.map((name, index) => `export const validate${name} = validators[${index}];\n`).join(""),
);
writeFileSync(
  out("validators.d.ts"),
  `${banner}export type ValidationError = Readonly<{ keywordLocation: string; instanceLocation: string }>;\n` +
    "export type Validate = ((data: unknown) => boolean) & { errors: readonly ValidationError[] | null };\n" +
    names.map((name) => `export declare const validate${name}: Validate;\n`).join(""),
);

// One document with local references, which generators for every language can read.
const definitions = {};
function localise(node) {
  if (Array.isArray(node)) {
    return node.map(localise);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const { $id: _id, $schema: _schema, $defs, ...rest } = node;
  for (const [name, definition] of Object.entries($defs ?? {})) {
    definitions[name] = localise(definition);
  }
  if (rest.discriminator !== undefined) {
    rest.discriminator = {
      ...rest.discriminator,
      mapping: Object.fromEntries(
        Object.entries(rest.discriminator.mapping).map(([tag, ref]) => [
          tag,
          `#/$defs/${ref.replace(/\.json$/, "")}`,
        ]),
      ),
    };
    return { ...rest, oneOf: localise(rest.oneOf) };
  }
  if (typeof rest.$ref === "string") {
    rest.$ref = `#/$defs/${rest.$ref.replace(/^#\/\$defs\//, "").replace(/\.json$/, "")}`;
  }
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, localise(value)]));
}
for (const name of names) {
  definitions[name] = localise(bundle.$defs[name]);
}
// Generators for other languages read the same single document.
writeFileSync(
  new URL("../schema/factbag-contracts.local.json", import.meta.url),
  `${JSON.stringify({ $schema: bundle.$schema, $defs: definitions }, null, 2)}\n`,
);
// The TypeScript generator predates 2020-12: it reads tuples from `items` and
// record entries from `additionalProperties`.
function downgrade(node) {
  if (Array.isArray(node)) {
    return node.map(downgrade);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const { prefixItems, unevaluatedProperties, ...rest } = node;
  if (prefixItems !== undefined) {
    rest.items = prefixItems;
  }
  if (unevaluatedProperties !== undefined) {
    rest.additionalProperties = unevaluatedProperties;
    delete rest.properties;
  }
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, downgrade(value)]));
}
const types = await compile({ $defs: downgrade(definitions) }, "FactbagContracts", {
  bannerComment: banner.trimEnd(),
  unreachableDefinitions: true,
  additionalProperties: false,
  format: false,
});
writeFileSync(out("types.ts"), types);
