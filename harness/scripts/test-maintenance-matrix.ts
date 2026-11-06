import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EXECUTION_APPROVAL_MODES } from "../src/domain/approval-policy.js";

const root = resolve(process.env.CADRE_MATRIX_REPORT_DIR ?? join(tmpdir(), `cadre-maintenance-${Date.now()}`));
mkdirSync(root, {recursive: true});
const clients = (process.env.CADRE_MATRIX_CLIENTS ?? "codex,claude-code,zed").split(",");
if (!clients.length || new Set(clients).size !== clients.length || clients.some((client) => !["codex", "claude-code", "zed"].includes(client))) {
  throw new Error("CADRE_MATRIX_CLIENTS must be a unique comma-separated subset of codex,claude-code,zed");
}
const clientPattern = `(?:${clients.join("|")})`, expected = clients.length * 220;
const shards = EXECUTION_APPROVAL_MODES.flatMap((mode) => ["sequential", "parallel"].map((schedule) => ({
  name: `${mode}-${schedule}`, pattern: `^maintenance ${clientPattern}/${mode}/${schedule}$`
}))).concat([{name: "quick-and-empty", pattern: `^(quick products|empty maintenance) ${clientPattern}$`}]);
let next = 0, failed = false;
async function worker() {
  while (next < shards.length) {
    const shard = shards[next++]!, directory = join(root, shard.name);
    mkdirSync(directory, {recursive: true});
    const output = createWriteStream(join(directory, "test.log"));
    const child = spawn(process.execPath, ["--import", "tsx", "--test", `--test-name-pattern=${shard.pattern}`, "test/matrices/maintenance.ts"], {
      env: {...process.env, CADRE_HOME: join(directory, "cache"), CADRE_MATRIX_REPORT_DIR: directory}, stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.pipe(output, {end: false}); child.stderr.pipe(output, {end: false});
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    await new Promise<void>((resolve) => output.end(resolve));
    if (code !== 0) failed = true;
    console.log(`${shard.name}: ${code === 0 ? "PASS" : "FAIL"} (${join(directory, "test.log")})`);
  }
}
console.log(`Running ${expected} packaged-protocol cases in four isolated workers. Evidence: ${root}`);
await Promise.all(Array.from({length: 4}, worker));
const cases = shards.flatMap(({name}) => {
  try {return JSON.parse(readFileSync(join(root, name, "matrix-results.json"), "utf8")).cases as Record<string, unknown>[];}
  catch {failed = true; return [];}
});
if (cases.length !== expected || cases.some((entry) => entry.status !== "passed")) failed = true;
writeFileSync(join(root, "summary.json"), JSON.stringify({expected, passed: cases.filter((entry) => entry.status === "passed").length,
  failed: cases.filter((entry) => entry.status !== "passed").length, complete: !failed, cases}, null, 2) + "\n");
console.log(`${cases.filter((entry) => entry.status === "passed").length}/${expected} cases passed. Summary: ${join(root, "summary.json")}`);
process.exitCode = failed ? 1 : 0;
