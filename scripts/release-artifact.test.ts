import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { integrity, readReleasePlan, verifyTarball } from "./release-artifact.ts";

const version = "0.0.0-alpha.1";

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

test("accepts standard alpha and stable release plans", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  for (const tag of ["alpha", "latest"]) {
    f.release.tag = tag;
    await f.save();
    const release = await readReleasePlan(f.directory, version, tag);
    await verifyTarball(
      path.join(f.directory, release.tarball.path),
      version,
      release.tarball.integrity,
    );
  }
});

test("rejects a changed tarball before publishing", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  await writeFile(path.join(f.directory, "factbag.tgz"), "tampered");
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
    await assert.rejects(readReleasePlan(f.directory, version, "latest"));
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
    await assert.rejects(readReleasePlan(f.directory, version, "latest"));
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
