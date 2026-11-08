import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

/** Include the unchanged license texts of packages actually present in the bundle. */
export function bundleNotices(inputs: string[], cwd: string): string {
  const packages = new Map<string, string>();
  for (const input of inputs.filter((path) => path.includes("node_modules/"))) {
    let directory = dirname(resolve(cwd, input));
    while (directory !== dirname(directory)) {
      if (existsSync(join(directory, "package.json"))) {
        const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {name?: string; version?: string};
        const licenses = readdirSync(directory).filter((name) => /^(license|licence|copying|notice)(\.|$)/i.test(name));
        if (pkg.name === "@sentry/server-utils" && !licenses.length) {
          // This published package omits its license file; the tagged monorepo
          // license matches the unchanged license shipped with @sentry/node.
          const sentryRoot = dirname(createRequire(import.meta.url).resolve("@sentry/node/package.json"));
          packages.set(`${pkg.name}@${pkg.version}`, readFileSync(join(sentryRoot, "LICENSE"), "utf8"));
          break;
        }
        if (pkg.name && !licenses.length) throw new Error(`Missing bundled license for ${pkg.name} in ${directory}`);
        if (pkg.name && licenses.length) {
          packages.set(`${pkg.name}@${pkg.version}`, licenses.map((name) => `${name}\n${readFileSync(join(directory, name), "utf8")}`).join("\n"));
          break;
        }
      }
      directory = dirname(directory);
    }
  }
  return [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => `=== ${name} ===\n${text}`).join("\n\n") + "\n";
}
