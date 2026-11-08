import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildRuntime } from "./build.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), temporary = mkdtempSync(join(tmpdir(), "cadre-package-telemetry-"));
const hook = join(temporary, "record.mjs"), log = join(temporary, "requests.jsonl");
writeFileSync(hook, `import {appendFileSync} from 'node:fs'; globalThis.fetch = async (url, options) => { appendFileSync(${JSON.stringify(log)}, JSON.stringify({url:String(url),body:String(options.body)})+'\\n'); return new Response('',{status:200}); };`);
const buildKeys = ["CADRE_BUILD_TELEMETRY", "CADRE_BUILD_SENTRY_DSN"];
const previous = Object.fromEntries(buildKeys.map((key) => [key, process.env[key]]));
const fixtureDsn = "https://build-fixture@build-recording.example/1";
try {
  for (const mode of ["missing", "empty", "invalid", "none", "sentry"]) {
    delete process.env.CADRE_BUILD_SENTRY_DSN;
    delete process.env.CADRE_BUILD_TELEMETRY;
    if (mode !== "missing") process.env.CADRE_BUILD_SENTRY_DSN = mode === "empty" ? "" : mode === "invalid" ? "invalid-private-value" : fixtureDsn;
    if (mode === "none") process.env.CADRE_BUILD_TELEMETRY = "none";
    await buildRuntime();
    const pkg = join(temporary, mode); mkdirSync(pkg);
    const entries = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).files as string[];
    for (const entry of [...entries, "package.json"]) cpSync(join(root, entry), join(pkg, entry), {recursive:true});
    for (const artifact of ["cadre-mcp.mjs", "cadre-cli.mjs", "THIRD_PARTY_NOTICES.txt"]) {
      const contents = readFileSync(join(pkg, "dist", artifact), "utf8");
      assert.doesNotMatch(contents, /invalid-private-value/);
      if (mode !== "sentry") {
        assert.doesNotMatch(contents, /@sentry\/|@opentelemetry\/|build-fixture|build-recording\.example/);
      } else if (artifact.endsWith(".mjs")) {
        assert.ok(contents.includes(fixtureDsn));
      }
    }
    for (const version of ["18.20.8", "20", "22"]) {
      const node = execFileSync("npx", ["--yes", `--package=node@${version}`, "node", "-p", "process.execPath"], {encoding:"utf8"}).trim();
      const home = join(temporary, `${mode}-${version}`); mkdirSync(home); writeFileSync(log, "");
      const env = {...process.env, CADRE_HOME:home, CADRE_TELEMETRY:"1", DO_NOT_TRACK:"0", CADRE_SENTRY_DSN:"https://public@recording.example/1"};
      const status = execFileSync(node, [join(pkg,"dist/cadre-cli.mjs"),"telemetry","status"], {env:{...env,CADRE_SENTRY_DSN:undefined},encoding:"utf8"});
      assert.match(status, mode === "sentry" ? /ON.*build-recording\.example/ : /OFF.*telemetry-free build/);
      execFileSync(node, ["--import",hook,join(pkg,"dist/cadre-cli.mjs"),"install","--prepare-only","--target","all"], {env,stdio:"pipe"});
      const records = readFileSync(log,"utf8");
      if(mode !== "sentry") assert.equal(records, ""); else assert.match(records,/transaction/);
      writeFileSync(log, "");
      execFileSync(node, ["--import",hook,join(pkg,"dist/cadre-cli.mjs"),"telemetry","disable"], {env:{...env,CADRE_TELEMETRY:"0"},stdio:"pipe"});
      assert.equal(readFileSync(log,"utf8"), "");
      const client = new Client({name:"codex",version:"1.0.0"});
      const transport = new StdioClientTransport({command:node,args:["--import",hook,join(pkg,"dist/cadre-mcp.mjs")],env:Object.fromEntries(Object.entries({...env,CADRE_TELEMETRY:"0"}).filter((entry):entry is [string,string]=>entry[1]!==undefined)),stderr:"pipe"});
      let stderr=""; transport.stderr?.on("data",(chunk:Buffer)=>{stderr+=chunk.toString();});
      await client.connect(transport); assert.equal((await client.listTools()).tools.length,21); await client.close();
      assert.match(stderr,/Cadre telemetry is OFF/); assert.equal(readFileSync(log,"utf8"),"");
      process.stdout.write(`Verified ${mode} self-contained CLI/MCP on Node ${version}\n`);
    }
  }
} finally {
  for (const key of buildKeys) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
  await buildRuntime(); rmSync(temporary,{recursive:true,force:true});
}
