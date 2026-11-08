export const PHASES = ["artifact.read", "context.read", "state.validate", "plan.validate", "candidate.inspect", "candidate.apply",
  "git", "worktree.create", "worktree.cleanup", "integration", "template.load", "response.validate", "response.format",
  "approval.wait", "install.prepare", "install.discover", "install.client", "install.configure", "cli.command"] as const;
export type Phase = typeof PHASES[number];
export type Outcome = "ok" | "error" | "approval_required" | "cancelled" | "declined" | "fallback_required";
export type Attributes = Record<string, string | number | boolean>;
export interface SafeError { code: string; message: string; frames: Array<{ filename: string; lineno: number; colno: number }> }
export interface SpanRecord { id: string; parent: string; phase: Phase; start: number; end: number; outcome: Outcome }
export interface OperationRecord {
  id: string; trace: string; name: string; kind: "mcp" | "resource" | "cli" | "startup";
  start: number; end: number; duration_ms: number; execution_ms: number; wait_ms: number;
  outcome: Outcome; attributes: Attributes; spans: SpanRecord[]; errors: SafeError[];
  counters: Record<string, number>; snapshot?: Attributes;
}
export interface TelemetryExporter {
  emit(record: OperationRecord): void | Promise<void>;
  flush(timeoutMs: number): PromiseLike<unknown>;
  discard(): void;
}
