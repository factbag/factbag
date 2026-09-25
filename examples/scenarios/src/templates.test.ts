import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { renderTemplate } from "./templates";

let directory: string;
let file: URL;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "factbag-template-"));
  file = pathToFileURL(join(directory, "document.txt"));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it("substitutes variables literally in one pass and preserves document whitespace", () => {
  writeFileSync(file, "To: {{ name }}\r\n\r\n{{name}} holds {{shares}} shares.\n");
  expect(renderTemplate(file, { name: "A $& {{company}}", shares: 77000 })).toBe(
    "To: A $& {{company}}\r\n\r\nA $& {{company}} holds 77000 shares.\n",
  );
});

it("reports missing variables with the explicitly bound file", () => {
  writeFileSync(file, "To: {{applicantName}}");
  expect(() => renderTemplate(file)).toThrow(
    `Missing template variable "applicantName" in ${file.href}`,
  );
  writeFileSync(file, "{{toString}}");
  expect(() => renderTemplate(file)).toThrow("Missing template variable");
});

it("rejects expressions rather than evaluating template code", () => {
  writeFileSync(file, "{{person.name}}");
  expect(() => renderTemplate(file)).toThrow("Invalid template variable");
});
