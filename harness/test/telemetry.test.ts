import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { resolveTelemetryConfig, writePreferences, telemetryNotice } from "../src/telemetry/config.js";
import { telemetryIdentity } from "../src/telemetry/identity.js";
import { operation, phase, outcome, observeProject, observeQuick, flushTelemetry, startTelemetry, stopTelemetry } from "../src/telemetry/runtime.js";
import { createSentryExporter } from "../src/telemetry/sentry.js";
import type { OperationRecord } from "../src/telemetry/types.js";
import { validateProject } from "../src/domain/state.js";
import { inspectionMetrics } from "../src/domain/inspection.js";

const envKeys = ["CADRE_HOME", "CADRE_TELEMETRY", "CADRE_SENTRY_DSN", "DO_NOT_TRACK", "CI", "NODE_TEST_CONTEXT"];
function fixture(t: { after: (fn: () => void) => void }) {
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const home = mkdtempSync(join(tmpdir(), "cadre-telemetry-"));
  for (const key of envKeys) delete process.env[key];
  process.env.CADRE_HOME = home;
  process.env.CADRE_SENTRY_DSN = "https://public@recording.example/1";
  t.after(() => { stopTelemetry(); for (const key of envKeys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } rmSync(home, { recursive: true, force: true }); });
  return home;
}
function recorder(records: OperationRecord[]) {
  startTelemetry({ announce: false, exporterFactory: async () => ({ emit: (record) => { records.push(record); }, flush: async () => true, discard() {} }) });
}
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("telemetry: precedence, default disclosure, persisted opt-out, CI and invalid DSNs", (t) => {
  const home = fixture(t);
  assert.equal(resolveTelemetryConfig().enabled, true);
  assert.match(telemetryNotice(), /ON.*No prompts.*cadre-ai telemetry disable/);
  writePreferences(() => ({ enabled: false }));
  assert.equal(resolveTelemetryConfig().enabled, false);
  process.env.CADRE_TELEMETRY = "1";
  assert.equal(resolveTelemetryConfig().enabled, true);
  process.env.DO_NOT_TRACK = "1";
  assert.equal(resolveTelemetryConfig().enabled, false);
  delete process.env.DO_NOT_TRACK; delete process.env.CADRE_TELEMETRY;
  writePreferences(() => ({})); process.env.CI = "true";
  assert.equal(resolveTelemetryConfig().enabled, false);
  writePreferences(() => ({ enabled: true }));
  assert.equal(resolveTelemetryConfig().enabled, true);
  process.env.CADRE_SENTRY_DSN = "";
  assert.equal(resolveTelemetryConfig().enabled, false);
  process.env.CADRE_SENTRY_DSN = "https://public@own.example/12";
  assert.equal(resolveTelemetryConfig().destination, "own.example");
  delete process.env.CADRE_SENTRY_DSN;
  writeFileSync(join(home, "telemetry.json"), "broken");
  assert.equal(resolveTelemetryConfig().enabled, false);
});

test("telemetry: concurrent contexts, nested timings, wait separation, safe errors, lifecycle snapshots", async (t) => {
  const home = fixture(t), records: OperationRecord[] = [];
  const roots = [join(home, "secret-project-A"), join(home, "secret-project-B")];
  roots.forEach((root) => mkdirSync(root)); recorder(records);
  await Promise.all(roots.map((root, index) => operation("project_status", "mcp", async () => {
    observeProject({ templateSetVersion: "v5", schemaVersion: 2, runtimeVersion: "3.9.0" },
      ["drafting-spec", "drafting-plan", "planned", "in_progress", "ready_for_review", "completed", "archived"].map((status) => ({ status })), 0);
    observeQuick({ completed: 7, archived: 3, staged: 2, commit_pending: 1 }, 1);
    await phase("context.read", () => phase("artifact.read", () => delay(2)));
    await phase("approval.wait", () => delay(15));
    if (index) throw new Error(`SECRET ${root} prompt password=token`);
    outcome("cancelled"); return 42;
  }, { projectRoot: root, client: { name: "codex-secret", version: "unsafe/private" } }).catch(() => 0)));
  await flushTelemetry();
  assert.equal(records.length, 2);
  assert.notEqual(records[0]!.attributes.cadre_project_id, records[1]!.attributes.cadre_project_id);
  assert.equal(records[0]!.attributes.installation_id, records[1]!.attributes.installation_id);
  assert.deepEqual(new Set(records.map((record) => record.outcome)), new Set(["cancelled", "error"]));
  for (const record of records) {
    assert.ok(record.wait_ms >= 10); assert.ok(record.execution_ms < record.duration_ms);
    assert.equal(record.snapshot!.tracks_active, 5); assert.equal(record.snapshot!.quick_completed, 4);
    assert.equal(record.attributes.project_template, "v5"); assert.equal(record.attributes.client_version, "unknown");
    assert.equal(record.spans[0]!.parent, record.spans[1]!.id);
  }
  assert.doesNotMatch(JSON.stringify(records), /SECRET|secret-project|password|unsafe\/private/);
});

test("telemetry: worktree IDs share Git common directory without running Git", (t) => {
  const home = fixture(t), root = join(home, "root"), worktree = join(home, "worktree");
  mkdirSync(join(root, ".git", "worktrees", "one"), { recursive: true }); mkdirSync(worktree);
  writeFileSync(join(worktree, ".git"), `gitdir: ${join(root, ".git", "worktrees", "one")}\n`);
  writeFileSync(join(root, ".git", "worktrees", "one", "commondir"), "../..\n");
  assert.deepEqual(telemetryIdentity(root), telemetryIdentity(worktree));
});

test("telemetry: disable discards queued records, synchronous errors retain original identity", async (t) => {
  fixture(t); const records: OperationRecord[] = []; recorder(records);
  const error = new Error("private details");
  assert.throws(() => operation("install", "cli", () => { throw error; }), (value) => value === error);
  writePreferences(() => ({ enabled: false })); await flushTelemetry();
  operation("install", "cli", () => 9); await flushTelemetry();
  assert.equal(records.length, 0);
});

test("telemetry: Sentry recording transport sanitizes all envelope types and custom DSN replaces default", async (t) => {
  fixture(t); process.env.CADRE_SENTRY_DSN = "https://public@own.example/12";
  const { getGlobalScope } = await import("@sentry/node");
  const pollution = getGlobalScope();
  pollution.setTag("SECRET_TAG", "SECRET"); pollution.setAttribute("SECRET_ATTR", "SECRET");
  pollution.setUser({email:"SECRET@example.test"}); pollution.addAttachment({filename:"SECRET",data:"SECRET"});
  t.after(() => pollution.clear());
  const requests: Array<{ url: string; body: string }> = [], original = globalThis.fetch;
  globalThis.fetch = (async (url, options) => { requests.push({ url: String(url), body: String(options?.body) }); return new Response("", { status: 200 }); }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  startTelemetry({ announce: false, exporterFactory: async (config) => createSentryExporter(config) });
  operation("project_status", "mcp", () => {
    observeProject({ templateSetVersion: "v8", schemaVersion: 2, runtimeVersion: "4.1.0" }, [{ status: "completed" }], 0);
    observeQuick({ completed: 3, archived: 1, staged: 0, commit_pending: 0 }, 0);
    phase("artifact.read", () => 1);
    try { throw new Error("SECRET /Users/private/file.ts token=xyz prompt hidden"); } catch (error) {
      assert.throws(() => operation("install", "cli", () => { throw error; }));
    }
  });
  await flushTelemetry();
  assert.ok(requests.length > 0);
  assert.ok(requests.every((request) => request.url.startsWith("https://own.example/")));
  const envelopes = requests.map((request) => request.body).join("\n");
  assert.doesNotMatch(envelopes, /SECRET|Users|token=xyz|prompt hidden|hostname|server_name/);
  assert.match(envelopes, /transaction/); assert.match(envelopes, /Cadre operation failed/);
  assert.match(envelopes, /cadre.operation.duration/); assert.match(envelopes, /cadre.project.snapshot/);
  writePreferences(() => ({ enabled: false }));
  const previous = requests.length;
  operation("install", "cli", () => 1); await flushTelemetry();
  assert.equal(requests.length, previous);
});

test("telemetry: bounded queue, exporter failures, bounded shutdown", async (t) => {
  fixture(t); let sent = 0;
  startTelemetry({ announce: false, exporterFactory: async () => ({ emit() { sent++; throw new Error("offline"); }, flush: async () => new Promise(() => {}), discard() {} }) });
  for (let i = 0; i < 200; i++) assert.equal(operation("install", "cli", () => 5), 5);
  const start = Date.now(); await flushTelemetry(30);
  assert.ok(Date.now() - start < 250); assert.ok(sent <= 64);
});

test("telemetry: enabled collection adds no Git or validation work", async (t) => {
  const home = fixture(t), root = join(home, "project"); mkdirSync(root);
  const disabled = inspectionMetrics(), enabled = inspectionMetrics();
  const before = validateProject(root, disabled);
  const records: OperationRecord[] = []; recorder(records);
  const after = operation("project_status", "mcp", () => validateProject(root, enabled), { projectRoot: root });
  await flushTelemetry(); assert.deepEqual(before, after); assert.deepEqual(enabled, disabled);
  assert.equal(records[0]!.snapshot!.complete, false);
});

test("telemetry: packaged CLI non-collecting commands and dry run preserve opt-out", (t) => {
  const home = fixture(t); writePreferences(() => ({ enabled: false }));
  const previous = readFileSync(join(home, "telemetry.json"), "utf8");
  for (const args of [["help"], ["--version"], ["doctor"], ["telemetry", "status"], ["install", "--target", "all", "--dry-run", "--yes", "--telemetry", "on"]]) {
    const result = spawnSync(process.execPath, ["dist/cadre-cli.mjs", ...args], { encoding: "utf8", env: process.env });
    assert.equal(result.status, 0, result.stderr); assert.equal(readFileSync(join(home, "telemetry.json"), "utf8"), previous);
  }
});

test("telemetry: disabled modes never initialize transport or make requests", async (t) => {
  const home = fixture(t); let initialized = 0, requests = 0; const original = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; throw new Error("unexpected network"); }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  const modes = [() => {process.env.CADRE_TELEMETRY = "0";}, () => {process.env.DO_NOT_TRACK = "1";},
    () => {process.env.CI = "1";}, () => {process.env.CADRE_SENTRY_DSN = "";},
    () => {process.env.CADRE_SENTRY_DSN = "malformed";}, () => {writePreferences(() => ({enabled: false}));},
    () => {writeFileSync(join(home, "telemetry.json"), "invalid");}];
  for (const mode of modes) {
    for (const key of envKeys.filter((key) => key !== "CADRE_HOME")) delete process.env[key];
    writeFileSync(join(home, "telemetry.json"), "{}"); mode();
    startTelemetry({announce: false, exporterFactory: async (config) => { initialized++; return createSentryExporter(config); }});
    assert.equal(operation("install", "cli", () => 9), 9); await flushTelemetry(); stopTelemetry();
  }
  assert.equal(initialized, 0); assert.equal(requests, 0);
});

test("telemetry: Sentry rate limits, offline failures and live disabling preserve operation results", async (t) => {
  fixture(t); process.env.CADRE_SENTRY_DSN = "https://public@own.example/12";
  let requests = 0; const original = globalThis.fetch;
  globalThis.fetch = (async () => { requests++; return new Response("", { status: 429, headers: { "retry-after": "60" } }); }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  startTelemetry({ announce: false, exporterFactory: async (config) => createSentryExporter(config) });
  operation("install", "cli", () => true); await flushTelemetry(); const limited = requests;
  operation("install", "cli", () => true); await flushTelemetry(); assert.equal(requests, limited);
  stopTelemetry();
  globalThis.fetch = (async () => { requests++; throw new Error("offline secret"); }) as typeof fetch;
  startTelemetry({ announce: false });
  assert.equal(operation("install", "cli", () => 7), 7); await flushTelemetry(); stopTelemetry();
  let aborted = false;
  globalThis.fetch = ((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
  })) as typeof fetch;
  startTelemetry({ announce: false }); operation("install", "cli", () => true);
  await delay(20); writePreferences(() => ({enabled: false}));
  operation("install", "cli", () => true); await flushTelemetry(); assert.equal(aborted, true);
});

test("telemetry: full Quick inspection counts corrupt records beyond the listing page", async (t) => {
  const home = fixture(t), root = join(home, "project"), records: OperationRecord[] = [];
  mkdirSync(join(root, ".cadre", "quick"), { recursive: true });
  mkdirSync(join(root, ".cadre", "stage", "quick-broken"), { recursive: true });
  writeFileSync(join(root, ".cadre", "quick", "broken.json"), "not json");
  const {quickStatus} = await import("../src/domain/quick-history.js");
  recorder(records); operation("project_status", "mcp", () => quickStatus(root, 0), {projectRoot: root}); await flushTelemetry();
  assert.equal(records[0]!.snapshot!.quick_invalid, 2);
  assert.equal(records[0]!.snapshot!.quick_complete, false);
});

test("telemetry: real MCP calls record returned errors, cancellation and resource reads", async (t) => {
  const home = fixture(t), records: OperationRecord[] = []; recorder(records);
  const {Client} = await import("@modelcontextprotocol/sdk/client/index.js");
  const {InMemoryTransport} = await import("@modelcontextprotocol/sdk/inMemory.js");
  const {ElicitRequestSchema} = await import("@modelcontextprotocol/sdk/types.js");
  const {createCadreServer} = await import("../src/mcp/server.js");
  const server = createCadreServer(), client = new Client({name:"codex",version:"1.0.0"}, {capabilities:{elicitation:{form:{}}}});
  client.setRequestHandler(ElicitRequestSchema, async () => { await delay(10); return {action:"cancel"}; });
  const [ct, st] = InMemoryTransport.createLinkedPair(); await server.connect(st); await client.connect(ct);
  t.after(() => {void client.close(); void server.close();});
  const invalid = await client.callTool({name:"state_validate", arguments:{projectRoot:home}});
  assert.ok(invalid);
  await client.callTool({name:"workflow_elicit",arguments:{kind:"approval", message:"Secret prompt", binding:"synthetic-test"}});
  const {CADRE_MCP_OUTPUT_SCHEMAS} = await import("../src/mcp/output-schemas.js");
  const {TEMPLATE_IDS} = await import("../src/domain/templates.js");
  const schema = CADRE_MCP_OUTPUT_SCHEMAS.template_get_many, originalParse = schema.parse;
  schema.parse = (() => {throw new Error("Secret output validation details");}) as typeof schema.parse;
  try {
    const failed = await client.callTool({name:"template_get_many",arguments:{ids:[TEMPLATE_IDS[0]]}});
    assert.equal(failed.isError,true);
  } finally {schema.parse = originalParse;}

  const resources = await client.listResources();
  await client.readResource({uri: resources.resources[0]!.uri});
  await flushTelemetry();
  assert.ok(records.some((record) => record.name === "workflow_elicit" && record.outcome === "cancelled" && record.wait_ms >= 8), JSON.stringify(records.map(({name,outcome,wait_ms}) => ({name,outcome,wait_ms}))));
  assert.ok(records.some((record) => record.name === "template.read"));
  assert.ok(records.some((record) => record.name === "template_get_many" && record.outcome === "error" && record.spans.some((span) => span.phase === "response.validate" && span.outcome === "error")));
  assert.doesNotMatch(JSON.stringify(records), /Secret prompt|Secret output validation details/);
});

test("telemetry: invalid configured DSN disables instead of retaining the default destination", (t) => {
  const home = fixture(t); delete process.env.CADRE_SENTRY_DSN;
  const result = spawnSync(process.execPath, ["dist/cadre-cli.mjs", "telemetry", "configure", "--dsn", ""], {encoding:"utf8",env:process.env});
  assert.equal(result.status, 1); assert.match(result.stderr,/no fallback/);
  assert.equal(resolveTelemetryConfig().enabled,false);
  assert.equal(JSON.parse(readFileSync(join(home,"telemetry.json"),"utf8")).dsn, "");
});
