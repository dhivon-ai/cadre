import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { countGitProcess } from "./inspection.js";
import { captureRepositoryBasis, type RepositoryBasis } from "./repository-basis.js";
import { productPathSchema, type QuickProduct } from "./quick-record.js";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function git(root: string, args: string[]): Buffer {
  countGitProcess();
  const result = spawnSync("git", ["--literal-pathspecs", ...args], {cwd: root, maxBuffer: 64 * 1024 * 1024, env: {...process.env, GIT_OPTIONAL_LOCKS: "0"}});
  if (result.status !== 0) throw new Error(`Cannot inspect quick Git evidence: ${result.stderr?.toString().trim()}`);
  return result.stdout;
}
type FileEvidence = QuickProduct["changes"][number]["before"];
function committedFile(root: string, commit: string, path: string): FileEvidence {
  const entry = git(root, ["ls-tree", "-z", commit, "--", path]).toString();
  if (!entry) return null;
  const match = /^(100644|100755) blob ([0-9a-f]{40})\t/.exec(entry);
  if (!match) throw new Error(`Quick supports regular product files only: ${path}`);
  return {mode: match[1] as "100644" | "100755", sha256: hash(git(root, ["cat-file", "blob", match[2]!]))};
}
function workingFile(root: string, path: string): FileEvidence {
  productPathSchema.parse(path);
  let absolute = root;
  for (const part of path.split("/")) {
    absolute = join(absolute, part);
    try { if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Unsafe quick product symlink: ${path}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) throw new Error(`Quick supports regular product files only: ${path}`);
  return {mode: stat.mode & 0o111 ? "100755" : "100644", sha256: hash(readFileSync(absolute))};
}
// Owned worktree bytes are approved separately. Staging those same files for
// the required combined commit must not invalidate resumable approval.
export const quickVerificationDigest = (basis: RepositoryBasis, productPaths: string[]) => {
  const owned = new Set(productPaths);
  return hash(JSON.stringify({...basis, index: basis.index.filter((entry) => !owned.has(entry.path))}));
};

/** New work cannot absorb or change edits that existed before this quick began. */
export function captureQuickProduct(root: string, baseline: RepositoryBasis, paths: string[]): QuickProduct {
  const current = captureRepositoryBasis(root, true);
  if (!baseline.head || current.head !== baseline.head) throw new Error("Quick Git baseline changed; preserve work and reassess");
  if (current.index.some((entry) => entry.stage !== "0")) throw new Error("Resolve Git conflicts before quick delivery");
  const preexisting = new Set(baseline.files.map((file) => file.path));
  if (paths.some((path) => preexisting.has(path))) throw new Error("Quick overlaps pre-existing edits; preserve them and separate the work");
  if (!isDeepStrictEqual(current.files.filter((file) => preexisting.has(file.path)), baseline.files)
    || !isDeepStrictEqual(current.index.filter((entry) => preexisting.has(entry.path)), baseline.index)) {
    throw new Error("Pre-existing edits changed during quick; preserve and reconcile them");
  }
  const changed = current.files.filter((file) => !preexisting.has(file.path)).map((file) => file.path).sort();
  if (!isDeepStrictEqual(changed, [...paths].sort())) throw new Error("Quick affectedPaths must cover exactly the new product changes");
  const changes = [...paths].sort().map((path) => {
    productPathSchema.parse(path);
    const before = committedFile(root, baseline.head!, path), after = workingFile(root, path);
    if (isDeepStrictEqual(before, after)) throw new Error(`Quick product path has no net change: ${path}`);
    return {path, before, after};
  });
  return {baseCommit: baseline.head, verificationDigest: quickVerificationDigest(current, paths), changes};
}

export function requireQuickProductFreshness(root: string, expected: QuickProduct): void {
  const current = captureRepositoryBasis(root, true);
  if (current.head !== expected.baseCommit || current.index.some((entry) => entry.stage !== "0")
    || quickVerificationDigest(current, expected.changes.map((change) => change.path)) !== expected.verificationDigest
    || expected.changes.some((change) => !isDeepStrictEqual(workingFile(root, change.path), change.after))) {
    throw new Error("Quick product or verification inputs changed after approval; preserve work and reassess");
  }
}

/** One direct child commit must contain exactly the approved product and Cadre artifacts. */
export function verifyQuickCommit(root: string, commit: string, expected: QuickProduct, cadrePaths: string[]): void {
  const parents = git(root, ["show", "-s", "--format=%P", commit]).toString().trim();
  if (parents !== expected.baseCommit) throw new Error("Quick requires one combined commit directly on its approved baseline");
  const changed = git(root, ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-r", "-z", commit]).toString().split("\0").filter(Boolean).sort();
  const approved = [...cadrePaths, ...expected.changes.map((file) => file.path)].sort();
  if (!isDeepStrictEqual(changed, approved)) throw new Error("Quick commit contains missing or unapproved changes");
  for (const change of expected.changes) {
    if (!isDeepStrictEqual(committedFile(root, expected.baseCommit, change.path), change.before)
      || !isDeepStrictEqual(committedFile(root, commit, change.path), change.after)) throw new Error(`Quick committed product differs from approval: ${change.path}`);
  }
}
