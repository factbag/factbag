import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

export interface PackedArtifact {
  name: string;
  version: string;
  tarball: { path: string; integrity: string };
}

export interface PackedManifest {
  name: string;
  version: string;
  private?: boolean;
  exports: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  publishConfig?: { access?: string };
  repository?: { url?: string };
}

function validateVersion(version: string): void {
  assert.match(
    version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u,
  );
}

export function integrity(bytes: Uint8Array, algorithm: "sha256" | "sha512"): string {
  return `${algorithm}-${createHash(algorithm).update(bytes).digest("base64")}`;
}

export async function verifyTarball(
  tarball: string,
  version: string,
  expected: string,
): Promise<PackedManifest> {
  validateVersion(version);
  assert.equal(
    integrity(await readFile(tarball), expected.startsWith("sha256-") ? "sha256" : "sha512"),
    expected,
    "Tarball integrity mismatch",
  );
  const result = spawnSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(result.stdout) as PackedManifest;
  assert.equal(manifest.name, "factbag");
  assert.equal(manifest.version, version);
  assert.notEqual(manifest.private, true);
  // npm may honor publishConfig over CLI options. Reject every unexpected override.
  assert.deepEqual(manifest.publishConfig, { access: "public" });
  assert.equal(manifest.repository?.url, "git+https://github.com/factbag/factbag.git");
  return manifest;
}

export async function readReleasePlan(
  directory: string,
  version: string,
  expectedTag: string,
): Promise<PackedArtifact> {
  validateVersion(version);
  const plan = JSON.parse(await readFile(path.join(directory, "publish-plan.json"), "utf8"));
  assert.equal(plan.version, 1);
  assert.equal(plan.plan.length, 1, "Expected exactly one release batch");
  assert.equal(plan.plan[0].length, 1, "Expected exactly one package");
  const release = plan.plan[0][0];
  assert.equal(release.name, "factbag");
  assert.equal(release.version, version);
  assert.equal(release.kind, "publish");
  assert.equal(release.access, "public");
  assert.equal(release.tag, expectedTag);
  assert.equal(typeof release.tarball.path, "string");
  assert.ok(!path.isAbsolute(release.tarball.path));
  const root = await realpath(directory);
  const tarball = await realpath(path.resolve(root, release.tarball.path));
  assert.ok(
    tarball.startsWith(`${root}${path.sep}`),
    "Tarball must be inside the release directory",
  );
  return release as PackedArtifact;
}
