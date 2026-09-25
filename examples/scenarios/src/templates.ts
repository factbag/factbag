import { readFileSync } from "node:fs";

/** Render an explicitly bound UTF-8 file with literal, single-pass {{variable}} substitution. */
export function renderTemplate(
  file: URL,
  variables: Readonly<Record<string, string | number>> = {},
): string {
  return readFileSync(file, "utf8").replace(
    /\{\{([\s\S]*?)\}\}/gu,
    (_match: string, key: string): string => {
      const name = key.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
        throw new Error(`Invalid template variable "${name}" in ${file.href}`);
      }
      const value = variables[name];
      if (!Object.hasOwn(variables, name) || value === undefined) {
        throw new Error(`Missing template variable "${name}" in ${file.href}`);
      }
      return String(value);
    },
  );
}
