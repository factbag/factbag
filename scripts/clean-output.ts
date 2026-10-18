import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = process.argv[2];
if (outputDirectory === undefined) {
  throw new Error("Usage: node scripts/clean-output.ts <output-directory>");
}

await rm(path.resolve(outputDirectory), { force: true, recursive: true });
