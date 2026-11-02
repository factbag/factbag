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
  expected: { name: string; version: string; integrity: string },
): Promise<PackedManifest> {
  validateVersion(expected.version);
  assert.equal(
    integrity(
      await readFile(tarball),
      expected.integrity.startsWith("sha256-") ? "sha256" : "sha512",
    ),
    expected.integrity,
    "Tarball integrity mismatch",
  );
  const result = spawnSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(result.stdout) as PackedManifest;
  assert.equal(manifest.name, expected.name);
  assert.equal(manifest.version, expected.version);
  assert.notEqual(manifest.private, true);
  // npm may honor publishConfig over CLI options. Reject every unexpected override.
  assert.deepEqual(manifest.publishConfig, { access: "public" });
  assert.equal(manifest.repository?.url, "git+https://github.com/factbag/factbag.git");
  return manifest;
}

/** Read a publish plan that releases exactly the expected packages at their versions. */
export async function readReleasePlan(
  directory: string,
  expected: ReadonlyMap<string, string>,
  expectedTag: string,
): Promise<PackedArtifact[]> {
  for (const version of expected.values()) validateVersion(version);
  const plan = JSON.parse(await readFile(path.join(directory, "publish-plan.json"), "utf8"));
  assert.equal(plan.version, 1);
  const releases = (plan.plan as unknown[][]).flat() as (PackedArtifact & {
    kind: string;
    access: string;
    tag: string;
  })[];
  assert.deepEqual(
    releases.map((release) => release.name).sort(),
    [...expected.keys()].sort(),
    "Expected every public package exactly once",
  );
  const root = await realpath(directory);
  for (const release of releases) {
    assert.equal(release.version, expected.get(release.name));
    assert.equal(release.kind, "publish");
    assert.equal(release.access, "public");
    assert.equal(release.tag, expectedTag);
    assert.equal(typeof release.tarball.path, "string");
    assert.ok(!path.isAbsolute(release.tarball.path));
    const tarball = await realpath(path.resolve(root, release.tarball.path));
    assert.ok(
      tarball.startsWith(`${root}${path.sep}`),
      "Tarball must be inside the release directory",
    );
  }
  return releases;
}
