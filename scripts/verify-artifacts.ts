import { access, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  {
    directory: "packages/factbag",
    entries: [
      "factbag/dsl",
      "factbag/kb",
      "factbag/query",
      "factbag/explain",
      "factbag/corpus",
      "factbag/guards",
      "factbag/jev/classifier",
      "factbag/jev/errors",
      "factbag/jev/recheck",
      "factbag/jev/resolve",
      "factbag/jev/staged",
    ],
  },
  {
    directory: "packages/core",
    entries: [
      "@factbag/core/dsl",
      "@factbag/core/kb",
      "@factbag/core/query",
      "@factbag/core/explain",
    ],
  },
  { directory: "packages/corpus", entries: ["@factbag/corpus"] },
  { directory: "packages/guards", entries: ["@factbag/guards"] },
  {
    directory: "packages/jev",
    entries: [
      "@factbag/jev/classifier",
      "@factbag/jev/errors",
      "@factbag/jev/recheck",
      "@factbag/jev/resolve",
      "@factbag/jev/staged",
    ],
  },
];

for (const packageDefinition of packages) {
  const expression = `await Promise.all(${JSON.stringify(packageDefinition.entries)}.map((entry) => import(entry)))`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", expression], {
    cwd: path.join(root, packageDefinition.directory),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Native Node import failed in ${packageDefinition.directory}:\n${result.stderr}`,
    );
  }
}

const relativeImport = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.{1,2}\/[^"']+)["']/gu;
await Promise.all(
  packages.map(async (packageDefinition) => {
    const dist = path.join(root, packageDefinition.directory, "dist");
    await Promise.all(
      (await javascriptFiles(dist)).map(async (file) => {
        const source = await readFile(file, "utf8");
        await Promise.all(
          [...source.matchAll(relativeImport)].map(async (match) => {
            const specifier = match[1];
            if (specifier === undefined) {
              throw new Error(`Could not read relative import in ${path.relative(root, file)}`);
            }
            const target = path.resolve(path.dirname(file), specifier);
            try {
              await access(target);
            } catch {
              throw new Error(
                `${path.relative(root, file)} contains unresolved relative import ${specifier}`,
              );
            }
          }),
        );
      }),
    );
  }),
);

async function javascriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry): Promise<string[]> | string[] => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return javascriptFiles(entryPath);
      }
      return entry.name.endsWith(".js") ? [entryPath] : [];
    }),
  );
  return files.flat();
}
