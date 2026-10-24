import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  integrity,
  prepare,
  validateVersion,
  verifyCandidate,
  verifyTarball,
} from "./release-artifact.ts";

const version = "0.0.0-alpha.1";
const commit = "a".repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "factbag-release-test-"));
  const directory = path.join(root, "release");
  await mkdir(path.join(root, "package"));
  await mkdir(directory);
  const manifest = {
    name: "factbag",
    version,
    publishConfig: { access: "public" },
    repository: { url: "git+https://github.com/factbag/factbag.git" },
  };
  async function pack(value: unknown = manifest) {
    await writeFile(path.join(root, "package/package.json"), JSON.stringify(value));
    const result = spawnSync("tar", [
      "-czf",
      path.join(directory, "factbag.tgz"),
      "-C",
      root,
      "package",
    ]);
    assert.equal(result.status, 0);
    return readFile(path.join(directory, "factbag.tgz"));
  }
  const bytes = await pack();
  const release = {
    name: "factbag",
    version,
    kind: "publish",
    access: "public",
    tag: "latest",
    tarball: { path: "factbag.tgz", integrity: integrity(bytes, "sha256") },
  };
  const plan = { version: 1, plan: [[release]] };
  async function save() {
    await writeFile(path.join(directory, "publish-plan.json"), JSON.stringify(plan));
  }
  await save();
  return { root, directory, manifest, bytes, pack, release, plan, save };
}

test("prepares exactly the reviewed bytes and binds metadata to the commit", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const digest = await prepare(f.directory, version, commit);
  assert.equal(digest, integrity(f.bytes, "sha512"));
  assert.deepEqual(await readFile(path.join(f.directory, "publish/factbag.tgz")), f.bytes);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(f.directory, "publish/release.json"), "utf8")),
    { version, commit, integrity: digest },
  );
});

test("rejects a changed tarball before publishing", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  await writeFile(path.join(f.directory, "factbag.tgz"), "tampered");
  await assert.rejects(prepare(f.directory, version, commit), /integrity mismatch/u);
  await assert.rejects(
    verifyTarball(path.join(f.directory, "factbag.tgz"), version, integrity(f.bytes, "sha512")),
    /integrity mismatch/u,
  );
});

for (const mutation of ["package", "version", "tag", "extra", "empty"] as const) {
  test(`rejects an unexpected release plan: ${mutation}`, async (t) => {
    const f = await fixture();
    t.after(() => rm(f.root, { recursive: true, force: true }));
    if (mutation === "package") f.release.name = "other";
    if (mutation === "version") f.release.version = "1.0.0";
    if (mutation === "tag") f.release.tag = "next";
    if (mutation === "extra") f.plan.plan[0]?.push(f.release);
    if (mutation === "empty") f.plan.plan = [];
    await f.save();
    await assert.rejects(prepare(f.directory, version, commit));
  });
}

test("rejects paths and symlinks outside the release directory", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  await writeFile(path.join(f.root, "outside.tgz"), f.bytes);
  await symlink(path.join(f.root, "outside.tgz"), path.join(f.directory, "link.tgz"));
  for (const filename of ["../outside.tgz", "link.tgz", path.join(f.root, "outside.tgz")]) {
    f.release.tarball.path = filename;
    await f.save();
    await assert.rejects(prepare(f.directory, version, commit));
  }
});

test("rejects publishConfig overrides and a mismatched packed identity", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  for (const overrides of [
    { publishConfig: { access: "public", registry: "https://example.com" } },
    { publishConfig: { access: "public", tag: "next" } },
    { name: "other" },
    { version: "1.0.0" },
    { private: true },
  ]) {
    const bytes = await f.pack({ ...f.manifest, ...overrides });
    await assert.rejects(
      verifyTarball(path.join(f.directory, "factbag.tgz"), version, integrity(bytes, "sha512")),
    );
  }
});

test("candidate verification binds the artifact to the approved version and commit", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const digest = await prepare(f.directory, version, commit);
  const directory = path.join(f.directory, "publish");
  await verifyCandidate(directory, version, commit, digest);
  await assert.rejects(verifyCandidate(directory, "1.0.0", commit, digest));
  await assert.rejects(verifyCandidate(directory, version, "b".repeat(40), digest));
  await assert.rejects(verifyCandidate(directory, version, commit, "sha512-other"));
});

test("version input cannot inject shell or workflow output syntax", () => {
  for (const input of [
    "1.0.0\nversion=other",
    "$(id)",
    "../other",
    "1.0.0;id",
    "--tag=other",
    "",
  ]) {
    assert.throws(() => validateVersion(input));
  }
  validateVersion(version);
  validateVersion("1.2.3");
});
