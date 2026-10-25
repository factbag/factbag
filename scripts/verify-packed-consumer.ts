import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  integrity,
  readReleasePlan,
  verifyTarball,
  type PackedArtifact,
  type PackedManifest,
} from "./release-artifact.ts";

interface CompilerManifest {
  name: string;
  version: string;
  bin: { tsc: string };
}

console.log(`Verifying packed packages on Node ${process.versions.node}`);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = path.join(root, "packages/factbag");
const packageManifest = JSON.parse(
  await readFile(path.join(packageDirectory, "package.json"), "utf8"),
) as PackedManifest;
assert.equal(packageManifest.name, "factbag");
assert.notEqual(packageManifest.private, true);
const releaseMode = process.argv.includes("--release");
const releaseDirectory = releaseMode
  ? path.join(root, ".release")
  : await mkdtemp(path.join(os.tmpdir(), "factbag-artifact-"));

try {
  let releases: PackedArtifact[];
  if (releaseMode) {
    const preState = await readFile(path.join(root, ".changeset/pre.json"), "utf8")
      .then((text) => JSON.parse(text) as { mode: string; tag: string })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      });
    const tag = preState?.mode === "pre" ? preState.tag : "latest";
    releases = [await readReleasePlan(releaseDirectory, packageManifest.version, tag)];
  } else {
    // CI verifies this checkout even when its version is already on npm.
    const tarballPath = "factbag.tgz";
    runPnpm(["pack", "--out", path.join(releaseDirectory, tarballPath)], packageDirectory);
    releases = [
      {
        name: packageManifest.name,
        version: packageManifest.version,
        tarball: {
          path: tarballPath,
          integrity: integrity(await readFile(path.join(releaseDirectory, tarballPath)), "sha256"),
        },
      },
    ];
  }

  for (const release of releases) {
    assert.equal(release.version, packageManifest.version);

    const tarball = path.join(releaseDirectory, release.tarball.path);
    const manifest = await verifyTarball(tarball, release.version, release.tarball.integrity);
    const files = tar(["-tf", tarball]).trim().split("\n").filter(Boolean);
    const documentation = new Set([
      "package/package.json",
      "package/LICENSE",
      "package/README.md",
      "package/CHANGELOG.md",
    ]);

    for (const requiredFile of documentation) {
      assert.ok(files.includes(requiredFile), `${release.name} is missing ${requiredFile}`);
    }
    for (const file of files) {
      assert.ok(
        file.startsWith("package/dist/") || documentation.has(file),
        `${release.name} contains unexpected file ${file}`,
      );
    }

    assert.equal(manifest.dependencies?.["@typesafe-ai/sdk"], undefined);
    assert.equal(manifest.optionalDependencies?.["@typesafe-ai/sdk"], undefined);
    assert.equal(manifest.peerDependencies?.["@typesafe-ai/sdk"], "^0.6.0");
    assert.equal(manifest.peerDependenciesMeta?.["@typesafe-ai/sdk"]?.optional, true);

    const exportTargets = stringsIn(manifest.exports);
    assert.ok(exportTargets.length > 0, `${release.name} has no exports`);
    for (const target of exportTargets) {
      assert.ok(
        target.startsWith("./dist/"),
        `${release.name} export points outside dist: ${target}`,
      );
      assert.ok(!target.includes("/src/"), `${release.name} export points to source: ${target}`);
      assert.ok(
        files.includes(`package/${target.slice(2)}`),
        `${release.name} export target is absent from tarball: ${target}`,
      );
    }

    for (const dependencies of [
      manifest.dependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ]) {
      for (const [name, range] of Object.entries(dependencies ?? {})) {
        assert.ok(!name.startsWith("@factbag/"), `Unpublished dependency: ${name}`);
        assert.ok(!["react", "react-dom", "lucide-react"].includes(name), `UI dependency: ${name}`);
        assert.ok(
          !range.startsWith("workspace:"),
          `${release.name} dependency ${name} uses ${range}`,
        );
        assert.ok(
          !range.startsWith("catalog:"),
          `${release.name} dependency ${name} uses ${range}`,
        );
      }
    }
  }

  const compilerNames = ["typescript6", "typescript"];
  const fixtureDirectory = path.join(root, "tooling/artifact-consumer");
  const devDependencies: Record<string, string> = {};
  for (const name of ["@types/node", ...compilerNames]) {
    const manifest = JSON.parse(
      await readFile(path.join(fixtureDirectory, "node_modules", name, "package.json"), "utf8"),
    ) as CompilerManifest;
    devDependencies[name] =
      name === manifest.name ? manifest.version : `npm:${manifest.name}@${manifest.version}`;
  }

  const sdkManifest = JSON.parse(
    await readFile(
      path.join(fixtureDirectory, "node_modules/@typesafe-ai/sdk/package.json"),
      "utf8",
    ),
  ) as { version: string };

  // The temporary project does not inherit workspace-local pnpm configuration.
  // Reuse the populated store while keeping its installation isolated.
  const storePath = workspaceStorePath();

  for (const withSdk of [false, true]) {
    console.log(
      `Checking ${withSdk ? "Jev with an explicit SDK" : "core, corpus, and guards without the SDK"}`,
    );
    const consumerDirectory = await mkdtemp(path.join(os.tmpdir(), "factbag-packed-consumer-"));
    try {
      const realConsumerDirectory = await realpath(consumerDirectory);
      const dependencies = Object.fromEntries(
        releases.map((release) => [
          release.name,
          `file:${path.join(releaseDirectory, release.tarball.path)}`,
        ]),
      );
      if (withSdk) dependencies["@typesafe-ai/sdk"] = sdkManifest.version;
      await writeFile(
        path.join(consumerDirectory, "package.json"),
        `${JSON.stringify(
          {
            name: "factbag-packed-consumer",
            version: "0.0.0",
            private: true,
            type: "module",
            packageManager: "pnpm@11.27.1",
            dependencies,
            devDependencies,
          },
          null,
          2,
        )}\n`,
      );
      await writeFile(
        path.join(consumerDirectory, "pnpm-workspace.yaml"),
        `packages:\n  - "."\noverrides:\n${Object.entries(dependencies)
          .map(([name, tarball]) => `  "${name}": "${tarball}"`)
          .join("\n")}\n`,
      );
      await Promise.all(
        (withSdk
          ? ["consumer.ts", "runtime.mjs", "base.mjs"]
          : ["without-sdk.ts", "without-sdk.mjs", "base.mjs"]
        ).map(async (file) =>
          writeFile(
            path.join(consumerDirectory, file),
            await readFile(path.join(root, "tooling/artifact-consumer", file)),
          ),
        ),
      );

      const config = JSON.parse(
        await readFile(path.join(fixtureDirectory, "tsconfig.json"), "utf8"),
      ) as { include: string[] };
      config.include = withSdk
        ? ["consumer.ts", "runtime.mjs"]
        : ["without-sdk.ts", "without-sdk.mjs"];
      await writeFile(path.join(consumerDirectory, "tsconfig.json"), JSON.stringify(config));
      runPnpm(
        [
          "install",
          "--offline",
          "--store-dir",
          storePath,
          "--ignore-scripts",
          "--no-frozen-lockfile",
          "--strict-peer-dependencies",
        ],
        consumerDirectory,
      );

      for (const release of releases) {
        const installedPackage = await realpath(
          path.join(consumerDirectory, "node_modules", ...release.name.split("/")),
        );
        assert.ok(
          installedPackage.startsWith(`${realConsumerDirectory}${path.sep}`),
          `${release.name} resolved outside the isolated consumer: ${installedPackage}`,
        );
      }

      // Invoke each compiler directly: npm aliases expose the same `tsc` binary name.
      for (const name of compilerNames) {
        const directory = path.join(consumerDirectory, "node_modules", name);
        const manifest = JSON.parse(
          await readFile(path.join(directory, "package.json"), "utf8"),
        ) as CompilerManifest;
        console.log(`Checking packed consumer with TypeScript ${manifest.version}`);
        run(
          process.execPath,
          [path.join(directory, manifest.bin.tsc), "-p", "tsconfig.json"],
          consumerDirectory,
        );
      }
      run(process.execPath, [withSdk ? "runtime.mjs" : "without-sdk.mjs"], consumerDirectory);
    } finally {
      await rm(consumerDirectory, { force: true, recursive: true });
    }
  }
} finally {
  if (!releaseMode) await rm(releaseDirectory, { force: true, recursive: true });
}

function tar(arguments_: string[]): string {
  const result = spawnSync("tar", arguments_, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`tar ${arguments_.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
}

function runPnpm(arguments_: string[], cwd: string): void {
  const pnpm = process.env["npm_execpath"];
  assert.ok(pnpm, "npm_execpath is required to run the repository pnpm version");
  run(process.execPath, [pnpm, ...arguments_], cwd);
}

function workspaceStorePath(): string {
  const pnpm = process.env["npm_execpath"];
  assert.ok(pnpm, "npm_execpath is required to run the repository pnpm version");
  const result = spawnSync(process.execPath, [pnpm, "store", "path", "--silent"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`pnpm store path failed with status ${result.status}: ${result.stderr}`);
  }
  const storePath = result.stdout.trim();
  assert.ok(path.isAbsolute(storePath), `Expected an absolute pnpm store path: ${storePath}`);
  return storePath;
}

function run(command: string, arguments_: string[], cwd: string): void {
  const result = spawnSync(command, arguments_, { cwd, encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${arguments_.join(" ")} failed with status ${result.status}`);
  }
}
