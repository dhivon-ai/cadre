import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { CADRE_RUNTIME_VERSION, TEMPLATE_SET_VERSION } from "../domain/version.js";
import { CADRE_MCP_TOOL_NAMES } from "../mcp/tool-names.js";
import { resolveTelemetryConfig, telemetryNotice, type TelemetryConfig } from "./config.js";
import { telemetryIdentity } from "./identity.js";
import { allowAttributes, safeError, safeVersion } from "./privacy.js";
import { PHASES, type Attributes, type OperationRecord, type Outcome, type Phase, type TelemetryExporter } from "./types.js";

interface Context { record: OperationRecord; parent: string; signature: string; tick: number }
const context = new AsyncLocalStorage<Context>();
const names = new Set<string>([...CADRE_MCP_TOOL_NAMES, "template.read", "install", "uninstall", "startup"]);
const actions = new Set(["preview", "apply", "inspect", "begin", "resume", "reconcile", "begin_quick", "prepare", "record_verification",
  "record_integration", "start", "record_commit", "complete", "block", "complete_task", "complete_phase", "complete_group", "start_task", "start_phase", "start_group", "handoff"]);
const id = (length: number) => randomBytes(length).toString("hex");
type Factory = (config: TelemetryConfig) => Promise<TelemetryExporter>;
const defaultFactory: Factory = async (config) => (await import("./sentry.js")).createSentryExporter(config);
let enabled = false, factory = defaultFactory;
let exporter: TelemetryExporter | undefined, exporterSignature = "", timer: NodeJS.Immediate | undefined;
const queue: Array<{ record: OperationRecord; signature: string }> = [];
let draining: Promise<void> | undefined;

/** Explicit bootstrap only: importing library modules does not enable telemetry. */
export function startTelemetry(options: { exporterFactory?: Factory; announce?: boolean } = {}): void {
  if (options.announce !== false) process.stderr.write(telemetryNotice());
  factory = options.exporterFactory ?? defaultFactory;
  enabled = true;
}
function currentConfig(): TelemetryConfig | undefined {
  if (!enabled) return undefined;
  try {
    const config = resolveTelemetryConfig();
    if (!config.enabled || (exporterSignature && exporterSignature !== config.signature)) {
      queue.length = 0; exporter?.discard(); exporter = undefined; exporterSignature = "";
    }
    return config.enabled ? config : undefined;
  } catch { return undefined; }
}
function schedule(): void {
  if (timer || draining) return;
  timer = setImmediate(() => { timer = undefined; void drain(); });
  timer.unref();
}
async function drain(): Promise<void> {
  if (draining) return draining;
  draining = (async () => {
    while (queue.length) {
      const config = currentConfig();
      if (!config) { queue.length = 0; break; }
      const next = queue.shift()!;
      if (next.signature !== config.signature) continue;
      try {
        if (!exporter) { exporter = await factory(config); exporterSignature = config.signature; }
        if (currentConfig()?.signature !== next.signature) continue;
        await exporter?.emit(next.record);
      } catch { /* Observability must never affect delivery. */ }
    }
  })().finally(() => { draining = undefined; if (queue.length) schedule(); });
  return draining;
}
function finish(ctx: Context): void {
  try {
    if (currentConfig()?.signature !== ctx.signature) return;
    const record = ctx.record;
    record.end = Date.now() / 1000;
    record.duration_ms = performance.now() - ctx.tick;
    record.wait_ms = Math.min(record.duration_ms, record.wait_ms);
    record.execution_ms = Math.max(0, record.duration_ms - record.wait_ms);
    record.attributes = allowAttributes(record.attributes);
    if (record.snapshot) record.snapshot = allowAttributes(record.snapshot);
    if (queue.length < 64) { queue.push({ record, signature: ctx.signature }); schedule(); }
  } catch { /* Best effort only. */ }
}
export function operation<T>(name: string, kind: OperationRecord["kind"], run: () => T,
  options: { projectRoot?: string | undefined; client?: { name: string; version: string } | undefined; action?: unknown } = {}): T {
  const config = currentConfig();
  if (!config) return run();
  let ctx: Context;
  try {
    const client = options.client?.name.toLowerCase() ?? "unknown";
    const family = client.includes("codex") ? "codex" : client.includes("claude") ? "claude" : client.includes("zed") ? "zed" : "unknown";
    let identity: Attributes = {};
    try { identity = telemetryIdentity(options.projectRoot); } catch { /* Read-only homes remain usable. */ }
    const spanId = id(8);
    ctx = { signature: config.signature, parent: spanId, tick: performance.now(), record: {
      id: spanId, trace: id(16), name: names.has(name) ? name : "unknown", kind,
      start: Date.now() / 1000, end: 0, duration_ms: 0, execution_ms: 0, wait_ms: 0, outcome: "ok", spans: [], errors: [], counters: {},
      attributes: { ...identity, release: CADRE_RUNTIME_VERSION, template_catalog: TEMPLATE_SET_VERSION,
        node_major: Number(process.versions.node.split(".")[0]), os: process.platform, client: family,
        client_version: safeVersion(options.client?.version), project_context: "unknown",
        environment: process.env.CADRE_TELEMETRY_ENVIRONMENT === "telemetry-test" ? "telemetry-test" : "production",
        action: typeof options.action === "string" && actions.has(options.action) ? options.action : "unspecified" }
    } };
  } catch { return run(); }
  return context.run(ctx, () => {
    try {
      const value = run();
      if (value instanceof Promise) return value.then((result) => { finish(ctx); return result; }, (error: unknown) => {
        reportError(error); finish(ctx); throw error;
      }) as T;
      finish(ctx); return value;
    } catch (error) { reportError(error); finish(ctx); throw error; }
  });
}
export function phase<T>(name: Phase, run: () => T): T {
  const ctx = context.getStore();
  if (!ctx || !PHASES.includes(name)) return run();
  const span = { id: id(8), parent: ctx.parent, phase: name, start: Date.now() / 1000, end: 0, outcome: "ok" as Outcome };
  const tick = performance.now();
  const end = () => {
    span.end = Date.now() / 1000;
    if (name === "approval.wait") ctx.record.wait_ms += performance.now() - tick;
    if (ctx.record.spans.length < 256) ctx.record.spans.push(span);
    else counter("dropped_spans");
  };
  return context.run({ ...ctx, parent: span.id }, () => {
    try {
      const value = run();
      if (value instanceof Promise) return value.then((result) => { end(); return result; }, (error: unknown) => {
        span.outcome = "error"; end(); throw error;
      }) as T;
      end(); return value;
    } catch (error) { span.outcome = "error"; end(); throw error; }
  });
}
export function outcome(value: Outcome): void { const ctx = context.getStore(); if (ctx && ctx.record.outcome !== "error") ctx.record.outcome = value; }
export function reportError(error: unknown): void {
  try {
    const ctx = context.getStore(); if (!ctx) return;
    ctx.record.outcome = "error";
    const safe = safeError(error);
    if (ctx.record.errors.length < 4 && !ctx.record.errors.some((entry) => entry.code === safe.code)) ctx.record.errors.push(safe);
  } catch { /* Never replace the real error. */ }
}
const counterNames = new Set(["file_reads", "reused_reads", "read_bytes", "git_processes", "dropped_spans"]);
export function counter(name: string, amount = 1): void {
  const ctx = context.getStore();
  if (ctx && counterNames.has(name) && Number.isFinite(amount) && amount >= 0) ctx.record.counters[name] = (ctx.record.counters[name] ?? 0) + amount;
}
export function bindProject(root: string, project?: { templateSetVersion?: unknown; schemaVersion?: unknown; runtimeVersion?: unknown }): void {
  const ctx = context.getStore(); if (!ctx) return;
  try {
    if (!ctx.record.attributes.cadre_project_id) Object.assign(ctx.record.attributes, telemetryIdentity(root));
    if (project) {
      ctx.record.attributes.project_template = typeof project.templateSetVersion === "string" && /^v\d{1,3}$/.test(project.templateSetVersion) ? project.templateSetVersion : "unknown";
      ctx.record.attributes.project_schema = typeof project.schemaVersion === "number" ? project.schemaVersion : 0;
      ctx.record.attributes.project_runtime = safeVersion(project.runtimeVersion);
    }
  } catch { /* Optional identity cannot block an operation. */ }
}
export function observeProject(project: { templateSetVersion?: unknown; schemaVersion?: unknown; runtimeVersion?: unknown } | null,
  tracks: Array<{ status: string }>, errorCount: number, staleCount = 0): void {
  const ctx = context.getStore(); if (!ctx) return;
  ctx.record.attributes.project_context = !project ? "missing" : errorCount ? "incomplete" : staleCount ? "stale" : "observed";
  ctx.record.attributes.project_template = typeof project?.templateSetVersion === "string" && /^v\d{1,3}$/.test(project.templateSetVersion) ? project.templateSetVersion : "unknown";
  ctx.record.attributes.project_schema = typeof project?.schemaVersion === "number" && Number.isInteger(project.schemaVersion) ? project.schemaVersion : 0;
  ctx.record.attributes.project_runtime = safeVersion(project?.runtimeVersion);
  const snapshot: Attributes = { observed_at: Date.now(), complete: project !== null && errorCount === 0, stale: staleCount > 0, validation_errors: errorCount, tracks_active: 0 };
  const statuses = ["drafting-spec", "drafting-plan", "planned", "in_progress", "ready_for_review", "completed", "archived", "unknown"];
  for (const status of statuses) snapshot[`tracks_${status}`] = 0;
  for (const track of tracks) {
    const status = statuses.includes(track.status) ? track.status : "unknown";
    snapshot[`tracks_${status}`] = Number(snapshot[`tracks_${status}`]) + 1;
    if (status !== "completed" && status !== "archived" ) snapshot.tracks_active = Number(snapshot.tracks_active) + 1;
  }
  ctx.record.snapshot = { ...ctx.record.snapshot, ...snapshot };
}
export function observeQuick(counts: { completed: number; archived: number; staged: number; commit_pending: number }, invalid: number, errors = 0): void {
  const ctx = context.getStore(); if (!ctx) return;
  ctx.record.snapshot = { ...ctx.record.snapshot, quick_completed: Math.max(0, counts.completed - counts.archived),
    quick_archived: counts.archived, quick_staged: counts.staged, quick_pending: counts.commit_pending, quick_invalid: invalid,
    observed_at: Date.now(), quick_complete: errors === 0, quick_validation_errors: errors };
}
export async function flushTelemetry(timeoutMs = 2000): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([(async () => { await drain(); if (currentConfig()) await exporter?.flush(Math.min(timeoutMs, 2000)); })(),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, Math.min(timeoutMs, 2000)); })]);
  } catch { /* Best effort. */ }
  finally { if (timeout) clearTimeout(timeout); }
}
export function stopTelemetry(): void {
  enabled = false; queue.length = 0; exporter?.discard(); exporter = undefined; exporterSignature = "";
  if (timer) clearImmediate(timer); timer = undefined;
}
