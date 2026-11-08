import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { assertRegularFile, ensurePrivateDirectory, telemetryHome } from "./config.js";

function stableId(file: string): string {
  try { writeFileSync(file, randomUUID(), { mode: 0o600, flag: "wx" }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  assertRegularFile(file);
  const id = readFileSync(file, "utf8");
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid telemetry identity");
  return id;
}
/** Filesystem-only Git common-directory resolution; never adds a Git subprocess. */
export function projectIdentityRoot(root: string): string {
  const canonical = realpathSync(root), dotGit = join(canonical, ".git");
  if (!existsSync(dotGit)) return canonical;
  const stat = lstatSync(dotGit);
  if (stat.isSymbolicLink()) return canonical;
  let gitDirectory = dotGit;
  if (stat.isFile()) {
    if (stat.size > 4096) return canonical;
    const match = /^gitdir: (.+)\s*$/.exec(readFileSync(dotGit, "utf8").trim());
    if (!match) return canonical;
    gitDirectory = resolve(canonical, match[1]!);
  }
  const commonFile = join(gitDirectory, "commondir");
  if (existsSync(commonFile)) {
    assertRegularFile(commonFile);
    gitDirectory = resolve(gitDirectory, readFileSync(commonFile, "utf8").trim());
  }
  return realpathSync(gitDirectory);
}
export function telemetryIdentity(projectRoot?: string): { installation_id: string; cadre_project_id?: string } {
  const directory = join(telemetryHome(), "telemetry-identities");
  ensurePrivateDirectory(directory);
  const installation_id = stableId(join(directory, "installation"));
  if (!projectRoot) return { installation_id };
  const key = createHmac("sha256", installation_id).update(projectIdentityRoot(projectRoot)).digest("hex");
  const file = join(directory, "projects", key);
  ensurePrivateDirectory(dirname(file));
  return { installation_id, cadre_project_id: stableId(file) };
}
