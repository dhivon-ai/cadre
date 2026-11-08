import { preferencesPath, resolveTelemetryConfig, telemetryNotice, validDsn, writePreferences } from "../src/telemetry/config.js";

export function runTelemetryCommand(args: string[]): number {
  const command = args[0] ?? "status";
  if (command === "status" && args.length <= 1) {
    const config = resolveTelemetryConfig();
    process.stdout.write(`${telemetryNotice()}Preferences: ${preferencesPath()}\nDestination: ${config.destination}\n`);
    return 0;
  }
  if (["enable", "disable"].includes(command) && args.length === 1) {
    writePreferences((saved) => ({ ...saved, enabled: command === "enable" }));
  } else if (command === "configure" && args[1] === "--dsn" && args.length === 3) {
    writePreferences((saved) => ({ ...saved, dsn: args[2]! }));
    if (!validDsn(args[2]!)) {
      process.stderr.write("Invalid or empty Sentry DSN saved; sending is disabled with no fallback. Supply an HTTPS ingestion DSN with public key and numeric project ID.\n");
      return 1;
    }
  } else if (command === "configure" && args[1] === "--default-dsn" && args.length === 2) {
    writePreferences(({ dsn: _dsn, ...saved }) => saved);
  } else throw new Error("Usage: cadre-ai telemetry status|enable|disable|configure --dsn <DSN>|configure --default-dsn");
  process.stdout.write(telemetryNotice());
  return 0;
}
