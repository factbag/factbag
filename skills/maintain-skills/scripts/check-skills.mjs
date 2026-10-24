import { lstat, readdir, readlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function checkSkills(root) {
  const canonical = join(root, "skills");
  if (!(await lstat(canonical)).isDirectory()) {
    throw new Error(`Expected a real directory: ${canonical}`);
  }
  const names = [];
  for (const entry of await readdir(canonical, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(`Canonical skill cannot be a symlink: ${entry.name}`);
    if (!entry.isDirectory()) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) || entry.name.length > 64) {
      throw new Error(`Invalid skill directory name: ${entry.name}`);
    }
    const path = join(canonical, entry.name, "SKILL.md");
    if (!(await lstat(path)).isFile()) throw new Error(`Expected a regular file: ${path}`);
    names.push(entry.name);
  }

  for (const harness of [".agents", ".claude"]) {
    const parent = join(root, harness);
    if (!(await lstat(parent)).isDirectory()) {
      throw new Error(`Expected a real directory: ${parent}`);
    }
    const path = join(parent, "skills");
    if (!(await lstat(path)).isSymbolicLink() || (await readlink(path)) !== "../skills") {
      throw new Error(`Expected directory symlink ${path} -> ../skills`);
    }
  }
  return names.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error("Usage: check-skills.mjs");
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const names = await checkSkills(root);
    console.log(`Validated ${names.length} skill directories and shared directory links.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
