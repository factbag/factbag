import assert from "node:assert/strict";
import {
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
import { syncLinks } from "./sync-links.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "factbag-skills-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await addSkill(root, "example");
  return root;
}

async function addSkill(root, name) {
  const directory = join(root, "skills", name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "SKILL.md"), `---\nname: ${name}\ndescription: Example\n---\n`);
}

test("check is read-only; sync creates relative links and is idempotent", async (t) => {
  const root = await fixture(t);
  assert.equal((await syncLinks(root, { check: true })).length, 2);
  await assert.rejects(readlink(join(root, ".agents/skills/example")), { code: "ENOENT" });
  assert.equal((await syncLinks(root)).length, 2);
  for (const harness of [".agents", ".claude"]) {
    const link = join(root, harness, "skills/example");
    assert.equal(await readlink(link), "../../skills/example");
    assert.match(await readFile(join(link, "SKILL.md"), "utf8"), /name: example/);
  }
  assert.deepEqual(await syncLinks(root), []);
  assert.deepEqual(await syncLinks(root, { check: true }), []);
});

test("renames and removals prune only conventionally managed links", async (t) => {
  const root = await fixture(t);
  await syncLinks(root);
  await symlink("../../personal", join(root, ".claude/skills/personal"));
  await rename(join(root, "skills/example"), join(root, "skills/renamed"));
  assert.equal((await syncLinks(root, { check: true })).length, 4);
  await syncLinks(root);
  await assert.rejects(readlink(join(root, ".agents/skills/example")), { code: "ENOENT" });
  assert.equal(await readlink(join(root, ".claude/skills/personal")), "../../personal");
  await rm(join(root, "skills/renamed"), { recursive: true });
  assert.equal((await syncLinks(root)).length, 2);
  assert.deepEqual(await syncLinks(root, { check: true }), []);
});

test("collision in the second harness prevents all writes", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, ".claude/skills"), { recursive: true });
  const collision = join(root, ".claude/skills/example");
  await writeFile(collision, "personal file");
  await assert.rejects(syncLinks(root), /conflicting entry/);
  assert.equal(await readFile(collision, "utf8"), "personal file");
  await assert.rejects(readlink(join(root, ".agents/skills/example")), { code: "ENOENT" });
});

test("incorrect symlink targets are not replaced", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, ".agents/skills"), { recursive: true });
  const link = join(root, ".agents/skills/example");
  await symlink("../../personal", link);
  await assert.rejects(syncLinks(root), /conflicting entry/);
  assert.equal(await readlink(link), "../../personal");
});

test("symlinked harness parents are rejected", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, "outside"));
  await symlink("outside", join(root, ".agents"));
  await assert.rejects(syncLinks(root), /real directory/);
  await rm(join(root, ".agents"));
  await mkdir(join(root, ".agents"));
  await symlink("../outside", join(root, ".agents/skills"));
  await assert.rejects(syncLinks(root), /real directory/);
});

test("canonical skills require valid names and regular SKILL.md files", async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, "skills/Bad-Name"));
  await assert.rejects(syncLinks(root), /Invalid skill directory/);
  await rm(join(root, "skills/Bad-Name"), { recursive: true });
  await mkdir(join(root, "skills/incomplete"));
  await assert.rejects(syncLinks(root), /Missing regular SKILL.md/);
});
