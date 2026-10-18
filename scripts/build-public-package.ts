import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript6";

interface Manifest {
  name: string;
  exports: Record<string, { types: string; import: string }>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "packages/factbag/dist");
const components = ["core", "corpus", "guards", "jev"];
const targets = new Map<string, { types: string; import: string }>();
const publicManifest = await manifest("factbag");

// Keep each component's module graph intact, including one shared copy of core.
// Only package specifiers change to relative paths inside the public tarball.
for (const component of components) {
  const source = await manifest(component);
  for (const [entry, target] of Object.entries(source.exports)) {
    assert.equal(
      target.types,
      target.import.replace(/\.js$/u, ".d.ts"),
      `Declarations must be adjacent to JavaScript for ${source.name}${entry}`,
    );
    targets.set(`${source.name}${entry === "." ? "" : entry.slice(1)}`, {
      types: path.join(destination, component, path.relative("dist", target.types)),
      import: path.join(destination, component, path.relative("dist", target.import)),
    });
  }
  for (const [name, range] of Object.entries(source.dependencies ?? {})) {
    if (!name.startsWith("@factbag/")) {
      assert.equal(
        publicManifest.dependencies?.[name] ??
          (publicManifest.peerDependencies?.[name]
            ? publicManifest.devDependencies?.[name]
            : undefined),
        range,
        `External dependency ${name} must be shipped or declared as a peer with a matching development version`,
      );
    }
  }
}

await rm(destination, { recursive: true, force: true });
for (const component of components) {
  await copyModules(
    path.join(root, "packages", component, "dist"),
    path.join(destination, component),
  );
}

async function manifest(component: string): Promise<Manifest> {
  return JSON.parse(
    await readFile(path.join(root, "packages", component, "package.json"), "utf8"),
  ) as Manifest;
}

async function copyModules(sourceDirectory: string, outputDirectory: string): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const outputPath = path.join(outputDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyModules(sourcePath, outputPath);
      continue;
    }
    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) {
      continue;
    }
    // Source maps from component builds refer to locations outside this package
    // and have stale columns after relocation, so do not ship those maps.
    let source = (await readFile(sourcePath, "utf8")).replace(
      /^\/\/[#@] sourceMappingURL=.*$/gmu,
      "",
    );
    const parsed = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
    const replacements: { start: number; end: number; text: string }[] = [];
    function visit(node: ts.Node): void {
      if (ts.isStringLiteral(node) && node.text.startsWith("@factbag/")) {
        const target = targets.get(node.text);
        assert.ok(target, `Unknown internal reference ${node.text} in ${sourcePath}`);
        // Declaration imports use the corresponding .js specifier, which NodeNext
        // resolves to the adjacent .d.ts; this also preserves class identity.
        let relative = path
          .relative(path.dirname(outputPath), target.import)
          .split(path.sep)
          .join("/");
        if (!relative.startsWith(".")) relative = `./${relative}`;
        replacements.push({
          start: node.getStart(parsed),
          end: node.end,
          text: JSON.stringify(relative),
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      source =
        source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
    }
    await writeFile(outputPath, source);
  }
}
