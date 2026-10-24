import { lstat, mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const harnesses = [".agents", ".claude"];
const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function stat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

export async function syncLinks(root, { check = false } = {}) {
  const entries = await readdir(join(root, "skills"), { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw new Error(`Canonical skill cannot be a symlink: ${entry.name}`);
    if (!entry.isDirectory()) continue;
    if (!validName.test(entry.name) || entry.name.length > 64) {
      throw new Error(`Invalid skill directory name: ${entry.name}`);
    }
    const skill = await stat(join(root, "skills", entry.name, "SKILL.md"));
    if (!skill?.isFile()) throw new Error(`Missing regular SKILL.md: ${entry.name}`);
    names.push(entry.name);
  }
  names.sort();

  // Preflight every harness before writing anything, so collisions do not leave
  // another harness partially updated. Never follow symlinked parent paths.
  const changes = [];
  for (const harness of harnesses) {
    const directory = join(root, harness, "skills");
    for (const path of [join(root, harness), directory]) {
      const info = await stat(path);
      if (info && !info.isDirectory()) throw new Error(`Expected a real directory: ${path}`);
    }
    for (const name of names) {
      const path = join(directory, name);
      const target = `../../skills/${name}`;
      const info = await stat(path);
      if (!info) changes.push({ action: "create", path, target });
      else if (!info.isSymbolicLink() || (await readlink(path)) !== target) {
        throw new Error(`Refusing to overwrite conflicting entry: ${path}`);
      }
    }
    if (!(await stat(directory))) continue;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (names.includes(entry.name) || !entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (validName.test(entry.name) && (await readlink(path)) === `../../skills/${entry.name}`) {
        changes.push({ action: "remove", path });
      }
    }
  }

  if (!check) {
    for (const change of changes) {
      if (change.action === "remove") await unlink(change.path);
      else {
        await mkdir(join(change.path, ".."), { recursive: true });
        await symlink(change.target, change.path, "dir");
      }
    }
  }
  return changes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== "--check")) throw new Error("Usage: sync-links.mjs [--check]");
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const check = args.includes("--check");
    const changes = await syncLinks(root, { check });
    for (const change of changes) {
      console.log(`${check ? "Needed" : "Applied"}: ${change.action} ${change.path}`);
    }
    if (check && changes.length) process.exitCode = 1;
    else
      console.log(`Skill links ${check ? "are up to date" : "synchronized"} (${basename(root)}).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
