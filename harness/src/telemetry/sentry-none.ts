import type { TelemetryExporter } from "./types.js";
export function createSentryExporter(): TelemetryExporter {
  return { emit() {}, async flush() {}, discard() {} };
}
