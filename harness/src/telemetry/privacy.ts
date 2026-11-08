import { CadreError } from "../domain/errors.js";
import type { Attributes, SafeError } from "./types.js";
import { ERROR_CODES, SOURCE_MODULES } from "./catalog.js";

const keys = new Set(["operation", "outcome", "kind", "error_code", "installation_id", "cadre_project_id", "client", "client_version", "release", "node_major", "os",
  "template_catalog", "project_template", "project_schema", "project_runtime", "project_context", "action", "environment",
  "observed_at", "stale", "complete", "validation_errors", "quick_staged", "quick_pending", "quick_completed", "quick_archived", "quick_invalid", "quick_complete", "quick_validation_errors",
  "tracks_active", "tracks_completed", "tracks_archived", "tracks_drafting-spec", "tracks_drafting-plan", "tracks_planned",
  "tracks_in_progress", "tracks_ready_for_review", "tracks_unknown"]);
export function allowAttributes(input: Attributes): Attributes {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => keys.has(key)
    && (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value) && value >= 0)
      || (typeof value === "string" && value.length <= 100 && /^[a-zA-Z0-9_.:-]+$/.test(value)))));
}
export function safeVersion(value: unknown): string {
  return typeof value === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value) ? value : "unknown";
}
export function safeError(error: unknown): SafeError {
  const code = error instanceof CadreError && ERROR_CODES.has(error.code) ? error.code : "CADRE_ERROR";
  const frames: SafeError["frames"] = [];
  if (error instanceof Error) for (const line of (error.stack ?? "").split("\n").slice(1, 25)) {
    const match = /(?:[/\\])([a-z0-9-]+\.(?:ts|mjs)):(\d+):(\d+)\)?$/.exec(line.trim());
    if (match && SOURCE_MODULES.has(match[1]!)) frames.push({ filename: `app:///${match[1]}`, lineno: Number(match[2]), colno: Number(match[3]) });
  }
  return { code, message: code === "CADRE_ERROR" ? "Cadre operation failed" : `Cadre failure: ${code}`, frames: frames.reverse().slice(-12) };
}
