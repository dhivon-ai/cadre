import { randomBytes } from "node:crypto";
import { NodeClient, createTransport, type Event } from "@sentry/node";
import { CADRE_RUNTIME_VERSION } from "../domain/version.js";
import { resolveTelemetryConfig, type TelemetryConfig } from "./config.js";
import { allowAttributes } from "./privacy.js";
import type { Attributes, OperationRecord, TelemetryExporter } from "./types.js";

type Envelope = Parameters<NodeClient["sendEnvelope"]>[0];
const eventId = () => randomBytes(16).toString("hex");
const release = `cadre-ai@${CADRE_RUNTIME_VERSION}`;
function typedAttributes(input: Attributes) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key,
    typeof value === "number" ? {value, type: Number.isInteger(value) ? "integer" as const : "double" as const}
      : typeof value === "boolean" ? {value, type:"boolean" as const} : {value, type:"string" as const}]));
}

/** Use only the isolated SDK transport. No global scopes, processors, integrations,
 * automatic capture, or attachment merging can add data to these envelopes. */
export function createSentryExporter(config: TelemetryConfig): TelemetryExporter {
  let discarded = false;
  const controllers = new Set<AbortController>();
  const permitted = () => !discarded && resolveTelemetryConfig().signature === config.signature;
  const client = new NodeClient({
    dsn: config.dsn, integrations: [], stackParser: () => [],
    includeServerName: false, sendDefaultPii: false, sendClientReports: false, maxBreadcrumbs: 0,
    enableLogs: false, enableMetrics: false,
    transport: (options) => createTransport({ ...options, bufferSize: 64 }, async (request) => {
      if (!permitted()) return { statusCode: 200 };
      const controller = new AbortController(); controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 1500); timeout.unref();
      try {
        const response = await fetch(options.url, { method: "POST", body: request.body as BodyInit,
          headers: { "Content-Type": "application/x-sentry-envelope" }, signal: controller.signal, redirect: "error" });
        await response.body?.cancel();
        return { statusCode: response.status, headers: {
          "x-sentry-rate-limits": response.headers.get("x-sentry-rate-limits"), "retry-after": response.headers.get("retry-after")
        } };
      } finally { clearTimeout(timeout); controllers.delete(controller); }
    })
  });
  function send(envelope: Envelope): void {
    if (permitted()) void Promise.resolve(client.sendEnvelope(envelope)).catch(() => {});
  }
  function sendEvent(event: Event): void {
    const event_id = eventId();
    send([{event_id, sent_at:new Date().toISOString()}, [[{type:event.type === "transaction" ? "transaction" : "event"}, {...event,event_id}]]]);
  }
  return {
    emit(record: OperationRecord) {
      if (!permitted()) return;
      const attributes = allowAttributes({ ...record.attributes, operation: record.name, outcome: record.outcome, kind: record.kind });
      const environment = attributes.environment === "telemetry-test" ? "telemetry-test" : "production";
      const trace = { trace_id: record.trace, span_id: record.id, op: `cadre.${record.kind}`, status: record.outcome === "error" ? "internal_error" : "ok" };
      sendEvent({ platform:"node", release, type: "transaction", transaction: record.name,
        start_timestamp: record.start, timestamp: record.end, environment, tags: attributes, contexts: { trace },
        spans: record.spans.map((span) => ({ trace_id: record.trace, span_id: span.id, parent_span_id: span.parent,
          op: `cadre.${span.phase}`, description: span.phase, start_timestamp: span.start, timestamp: span.end,
          status: span.outcome === "error" ? "internal_error" : "ok", data: {} })),
        measurements: Object.fromEntries(Object.entries({ duration_ms: record.duration_ms, execution_ms: record.execution_ms,
          wait_ms: record.wait_ms, ...record.counters }).map(([name, value]) => [name, { value, unit: name.endsWith("_ms") ? "millisecond" : "none" }]))
      });
      for (const error of record.errors) sendEvent({ platform:"node", release,
        timestamp: record.end, level: "error", environment, contexts: { trace }, transaction: record.name,
        tags: { ...attributes, error_code: error.code }, fingerprint: [record.name, error.code],
        exception: { values: [{ type: error.code, value: error.message, ...(error.frames.length ? { stacktrace: { frames: error.frames } } : {}) }] }
      });
      const labels = { ...attributes }; delete labels.installation_id; delete labels.cadre_project_id;
      const metricAttributes = typedAttributes({...labels, "sentry.environment":environment, "sentry.release":release});
      const metric = (name: string, value: number, type: "counter" | "distribution") => ({ name, value, type,
        unit: type === "counter" ? "none" as const : "millisecond" as const, timestamp:record.end, trace_id:record.trace, span_id:record.id, attributes:metricAttributes });
      const metrics = [metric("cadre.operations",1,"counter"), metric("cadre.operation.duration",record.duration_ms,"distribution"),
        metric("cadre.operation.execution",record.execution_ms,"distribution"), metric("cadre.operation.wait",record.wait_ms,"distribution")];
      if (record.outcome === "error") metrics.push(metric("cadre.errors",1,"counter"));
      // The wire format is pinned to Sentry 10.75.2. Explicitly suppress ingestion
      // enrichment too; this is the same v2 container used by the SDK public API.
      const ingest_settings = {infer_ip:"never",infer_user_agent:"never"} as const;
      send([{}, [[{type:"trace_metric",item_count:metrics.length,content_type:"application/vnd.sentry.items.trace-metric+json"},
        {version:2,ingest_settings,items:metrics}]]]);
      if (record.snapshot) send([{}, [[{type:"log",item_count:1,content_type:"application/vnd.sentry.items.log+json"},
        {version:2,ingest_settings,items:[{timestamp:record.end,level:"info",severity_number:9,body:"cadre.project.snapshot",trace_id:record.trace,
          attributes:typedAttributes({...allowAttributes({...attributes,...record.snapshot}), "sentry.environment":environment, "sentry.release":release})}]}]]]);
    },
    flush: (timeout) => client.flush(timeout),
    discard() {
      discarded = true;
      for (const controller of controllers) controller.abort();
      void Promise.resolve(client.close(1)).catch(() => {});
    }
  };
}
