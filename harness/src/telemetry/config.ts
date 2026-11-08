import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_DSN, TELEMETRY_AVAILABLE } from "./defaults.js";

export interface Preferences { enabled?: boolean; dsn?: string; revision?: string }
export interface TelemetryConfig {
  enabled: boolean; dsn: string; destination: string; reason: string; signature: string;
}
export function telemetryHome(): string { return resolve(process.env.CADRE_HOME || join(homedir(), ".cadre")); }
export function preferencesPath(): string { return join(telemetryHome(), "telemetry.json"); }

export function assertRegularFile(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 65536) throw new Error("Unsafe telemetry settings file");
}
export function ensurePrivateDirectory(directory: string): void {
  if (existsSync(directory)) {
    const stat = lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Unsafe telemetry settings directory");
    return;
  }
  const parent = dirname(directory);
  if (parent !== directory) ensurePrivateDirectory(parent);
  mkdirSync(directory, { mode: 0o700 });
}
export function readPreferences(): Preferences {
  const home = telemetryHome();
  if (existsSync(home) && lstatSync(home).isSymbolicLink()) throw new Error("Unsafe telemetry settings directory");
  const file = preferencesPath();
  if (!existsSync(file)) return {};
  assertRegularFile(file);
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid telemetry preferences");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["enabled", "dsn", "revision"].includes(key))
    || (data.enabled !== undefined && typeof data.enabled !== "boolean")
    || (data.dsn !== undefined && typeof data.dsn !== "string")
    || (data.revision !== undefined && typeof data.revision !== "string")) throw new Error("Invalid telemetry preferences");
  return data as Preferences;
}
export function writePreferences(update: (previous: Preferences) => Preferences): void {
  ensurePrivateDirectory(telemetryHome());
  const file = preferencesPath(), next = { ...update(readPreferences()), revision: randomUUID() };
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, file);
  } finally { try { unlinkSync(temporary); } catch { /* Already renamed. */ } }
}
export function validDsn(dsn: string): boolean {
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" && Boolean(url.username) && !url.password && !url.search && !url.hash
      && /\/\d+$/.test(url.pathname) && !/[\s]/.test(dsn);
  } catch { return false; }
}
export function resolveTelemetryConfig(): TelemetryConfig {
  const off = (reason: string): TelemetryConfig => ({ enabled: false, dsn: "", destination: "none", reason, signature: `off:${reason}` });
  if (!TELEMETRY_AVAILABLE) return off("telemetry-free build");
  if (process.env.DO_NOT_TRACK === "1") return off("DO_NOT_TRACK=1");
  if (process.env.CADRE_TELEMETRY === "0") return off("CADRE_TELEMETRY=0");
  if (process.env.CADRE_TELEMETRY !== undefined && process.env.CADRE_TELEMETRY !== "1") return off("invalid CADRE_TELEMETRY (use 0 or 1)");
  let saved: Preferences;
  try { saved = readPreferences(); } catch { return off("unreadable or malformed telemetry preferences"); }
  const explicit = process.env.CADRE_TELEMETRY === "1" ? true : saved.enabled;
  if (explicit === false) return off("saved preference");
  if (explicit === undefined && (process.env.CI || process.env.NODE_TEST_CONTEXT)) return off("CI/test default");
  const dsn = process.env.CADRE_SENTRY_DSN ?? saved.dsn ?? DEFAULT_DSN;
  if (!validDsn(dsn)) return off("invalid or empty DSN; no fallback destination used");
  const destination = new URL(dsn).host;
  return { enabled: true, dsn, destination, reason: explicit === true ? "explicitly enabled" : "default on",
    signature: `${saved.revision ?? "default"}:${dsn}` };
}
export function telemetryNotice(): string {
  const config = resolveTelemetryConfig();
  return config.enabled
    ? `Cadre telemetry is ON (${config.dsn === DEFAULT_DSN ? "Dhivon AI Sentry" : "custom Sentry"}: ${config.destination}). Sends operation timings, sanitized errors, versions, project/track/Quick counts and random IDs. No prompts, source, file contents, names, paths or raw MCP data. Disable: cadre-ai telemetry disable (or CADRE_TELEMETRY=0 / DO_NOT_TRACK=1). Own destination: cadre-ai telemetry configure --dsn <DSN>.\n`
    : `Cadre telemetry is OFF (${config.reason}). No telemetry is sent.\n`;
}
