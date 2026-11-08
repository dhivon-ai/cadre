import { build } from "esbuild";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validDsn } from "../src/telemetry/config.js";
import { bundleNotices } from "./bundle-notices.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Bundle {
  entry: string;
  output: string;
  executable?: boolean;
}

const bundles: Bundle[] = [
  { entry: "src/mcp/server.ts", output: "dist/cadre-mcp.mjs" },
  { entry: "scripts/cli.ts", output: "dist/cadre-cli.mjs", executable: true }
];

export async function buildRuntime(): Promise<string[]> {
  const dsn = process.env.CADRE_BUILD_SENTRY_DSN ?? "";
  const telemetry = process.env.CADRE_BUILD_TELEMETRY !== "none" && validDsn(dsn);
  if (!telemetry) process.stderr.write("Building without Sentry telemetry (disabled or missing/invalid build DSN).\n");
  const inputs = new Set<string>();
  const outputs = await Promise.all(bundles.map(async (bundle) => {
    const output = resolve(projectRoot, bundle.output);
    mkdirSync(dirname(output), { recursive: true });
    const result = await build({
      entryPoints: [resolve(projectRoot, bundle.entry)],
      outfile: output,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node18",
      sourcemap: false,
      minify: false,
      legalComments: "none",
      metafile: true,
      plugins: [{
        name: "build-telemetry",
        setup(build) {
          build.onResolve({ filter: /\/(defaults|sentry)\.js$/ }, (args) => {
            if (dirname(args.importer) !== resolve(projectRoot, "src/telemetry")) return undefined;
            if (args.path.endsWith("/defaults.js")) return { path: "defaults", namespace: "cadre-build-telemetry" };
            return telemetry ? undefined : { path: resolve(projectRoot, "src/telemetry/sentry-none.ts") };
          });
          build.onLoad({ filter: /^defaults$/, namespace: "cadre-build-telemetry" }, () => ({
            contents: `export const DEFAULT_DSN = ${JSON.stringify(telemetry ? dsn : "")}; export const TELEMETRY_AVAILABLE = ${telemetry};`,
            loader: "js"
          }));
        }
      }],
      banner: { js: `${bundle.executable ? "#!/usr/bin/env node\n" : ""}import { createRequire as cadreCreateRequire } from "node:module"; const require = cadreCreateRequire(import.meta.url);` }
    });
    for (const input of Object.keys(result.metafile.inputs)) inputs.add(input);
    if (bundle.executable) chmodSync(output, 0o755);
    return output;
  }));
  writeFileSync(resolve(projectRoot, "dist/THIRD_PARTY_NOTICES.txt"), bundleNotices([...inputs], process.cwd()));
  return outputs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outputs = await buildRuntime();
  process.stdout.write(`Built ${outputs.length} Cadre runtime bundles.\n`);
}
