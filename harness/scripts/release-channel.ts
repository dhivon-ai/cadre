import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const core = "(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)";
const stableTag = new RegExp(`^(?:v|release-)?(${core})$`);

/** Resolve the channel from the event and tag, never from a caller-supplied npm tag. */
export function releaseChannel(event: string, tag: string, packageVersion: string): { version: string; channel: "latest" } {
  if (event !== "release") throw new Error(`Unsupported publication event: ${event}`);
  const match = stableTag.exec(tag);
  if (!match || match[0] !== tag) throw new Error("Stable publication requires a stable version tag");
  const version = match[1]!;
  if (version !== packageVersion) throw new Error(`Tag resolves to ${version}, but cadre-ai is ${packageVersion}; update and validate the candidate versions first`);
  return { version, channel: "latest" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const metadata = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
  const result = releaseChannel(process.env.GITHUB_EVENT_NAME ?? "", process.env.RELEASE_TAG ?? "", metadata.version);
  if (!process.env.GITHUB_OUTPUT) throw new Error("GitHub Actions output file is required");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${result.version}\nchannel=${result.channel}\n`);
  process.stdout.write(`Publishing cadre-ai@${result.version} to ${result.channel}\n`);
}
