import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve(process.argv[2] ?? "dist");
const relativeSpecifier =
  /((?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'])(\.{1,2}\/[^"']+)(["'])/gu;

await Promise.all(
  (await declarationFiles(outputDirectory)).map(async (file) => {
    const source = await readFile(file, "utf8");
    const rewritten = source.replace(relativeSpecifier, (match, prefix, specifier, suffix) => {
      if (path.extname(specifier)) {
        return match;
      }

      const target = path.resolve(path.dirname(file), specifier);
      if (existsSync(`${target}.d.ts`)) {
        return `${prefix}${specifier}.js${suffix}`;
      }
      if (existsSync(path.join(target, "index.d.ts"))) {
        return `${prefix}${specifier}/index.js${suffix}`;
      }

      throw new Error(
        `${path.relative(process.cwd(), file)} has unresolved declaration import ${specifier}`,
      );
    });

    if (rewritten !== source) {
      await writeFile(file, rewritten);
    }
  }),
);

async function declarationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry): Promise<string[]> | string[] => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return declarationFiles(entryPath);
      }
      return entry.name.endsWith(".d.ts") ? [entryPath] : [];
    }),
  );
  return files.flat();
}
