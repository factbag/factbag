import assert from "node:assert/strict";
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkSkills } from "./check-skills.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "factbag-skills-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await addSkill(root, "example");
  for (const harness of [".agents", ".claude"]) {
    await mkdir(join(root, harness));
    await symlink("../skills", join(root, harness, "skills"), "dir");
  }
  return root;
}

async function addSkill(root, name) {
  const directory = join(root, "skills", name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: Example\n---\n`);
}

test("directory links expose additions, renames, and removals without regeneration", async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await checkSkills(root), ["example"]);
  await addSkill(root, "added");
  await rename(join(root, "skills/example"), join(root, "skills/renamed"));
  assert.deepEqual(await checkSkills(root), ["added", "renamed"]);
  for (const harness of [".agents", ".claude"]) {
    assert.match(
      await readFile(join(root, harness, "skills/added/SKILL.md"), "utf8"),
      /name: added/,
    );
    assert.equal((await lstat(join(root, harness, "skills/renamed/SKILL.md"))).isFile(), true);
    await assert.rejects(lstat(join(root, harness, "skills/example")), { code: "ENOENT" });
  }
  await rm(join(root, "skills/renamed"), { recursive: true });
  assert.deepEqual(await checkSkills(root), ["added"]);
});

test("missing links are reported without repair", async (t) => {
  const root = await fixture(t);
  const path = join(root, ".claude/skills");
  await rm(path);
  await assert.rejects(checkSkills(root), { code: "ENOENT" });
  await assert.rejects(lstat(path), { code: "ENOENT" });
});

test("real directories and plain files are rejected without changes", async (t) => {
  const root = await fixture(t);
  const path = join(root, ".claude/skills");
  await rm(path);
  await mkdir(path);
  await writeFile(join(path, "personal"), "keep");
  await assert.rejects(checkSkills(root), /Expected directory symlink/);
  assert.equal(await readFile(join(path, "personal"), "utf8"), "keep");
  await rm(path, { recursive: true });
  await writeFile(path, "../skills");
  await assert.rejects(checkSkills(root), /Expected directory symlink/);
  assert.equal(await readFile(path, "utf8"), "../skills");
});

test("incorrect targets and symlinked harness parents are rejected", async (t) => {
  const root = await fixture(t);
  const path = join(root, ".agents/skills");
  await rm(path);
  await symlink("../missing", path, "dir");
  await assert.rejects(checkSkills(root), /Expected directory symlink/);
  assert.equal(await readlink(path), "../missing");
  await rm(path);
  await rm(join(root, ".agents"), { recursive: true });
  await symlink(".claude", join(root, ".agents"), "dir");
  await assert.rejects(checkSkills(root), /Expected a real directory/);
});

test("invalid names and missing or symlinked entry files are rejected", async (t) => {
  const root = await fixture(t);
  await addSkill(root, "Bad-Name");
  await assert.rejects(checkSkills(root), /Invalid skill directory/);
  await rm(join(root, "skills/Bad-Name"), { recursive: true });
  const path = join(root, "skills/example/SKILL.md");
  await rm(path);
  await assert.rejects(checkSkills(root), { code: "ENOENT" });
  await symlink("../../missing", path);
  await assert.rejects(checkSkills(root), /Expected a regular file/);
});

test("symlinked canonical roots and skill directories are rejected", async (t) => {
  const root = await fixture(t);
  await symlink("example", join(root, "skills/linked"), "dir");
  await assert.rejects(checkSkills(root), /Canonical skill cannot be a symlink/);
  await rename(join(root, "skills"), join(root, "moved-skills"));
  await symlink("moved-skills", join(root, "skills"), "dir");
  await assert.rejects(checkSkills(root), /Expected a real directory/);
});
