/** Explicit, synthetic-only ingestion check. Never scans a repository. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTelemetry, operation, phase, observeProject, observeQuick, flushTelemetry, stopTelemetry } from "../src/telemetry/runtime.js";
if (!process.argv.includes("--send")) throw new Error("Pass --send to transmit synthetic telemetry to the configured Sentry destination");
if (!process.env.CADRE_SENTRY_DSN) throw new Error("Set CADRE_SENTRY_DSN explicitly for synthetic verification");
const home = mkdtempSync(join(tmpdir(), "cadre-sentry-verification-"));
process.env.CADRE_HOME = home;
process.env.CADRE_TELEMETRY = "1";
process.env.CADRE_TELEMETRY_ENVIRONMENT = "telemetry-test";
startTelemetry();
try {
  for (let index = 0; index < 3; index++) {
    try {
      await operation("project_status", "mcp", async () => {
        observeProject({ templateSetVersion: "v8", schemaVersion: 2, runtimeVersion: "4.1.0" },
          ["planned", "in_progress", "completed", "archived"].map((status) => ({status})), 0);
        observeQuick({ completed: 5, archived: 2, staged: 1, commit_pending: 1 }, 0);
        await phase("context.read", () => phase("artifact.read", () => new Promise((resolve) => setTimeout(resolve, 12))));
        if (index === 2) throw new Error("Synthetic error: this text must be removed");
      }, { projectRoot: home, client: { name: "codex", version: "1.0.0" } });
    } catch { /* Intentional error */ }
  }
  await flushTelemetry();
} finally { stopTelemetry(); rmSync(home, { recursive: true, force: true }); }
process.stdout.write("Synthetic telemetry-test operations queued and bounded flush completed; verify receipt in Sentry.\n");
