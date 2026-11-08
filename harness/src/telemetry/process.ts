import { spawnSync as nativeSpawnSync } from "node:child_process";
import { counter, phase } from "./runtime.js";

/** Preserve every native overload; deliberately never record command arguments/output. */
export const spawnSync: typeof nativeSpawnSync = ((...args: Parameters<typeof nativeSpawnSync>) => {
  if (args[0] === "git") counter("git_processes");
  return phase(args[0] === "git" ? "git" : "cli.command", () => nativeSpawnSync(...args));
}) as typeof nativeSpawnSync;
