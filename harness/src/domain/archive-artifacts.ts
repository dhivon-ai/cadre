import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { DiscoveredTrack } from "./state.js";

export function dependencyOrder(tracks: DiscoveredTrack[]): string[] {
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const ordered: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`track dependency cycle includes ${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id); visited.add(id); ordered.push(id);
  };
  for (const track of tracks) visit(track.id);
  return ordered;
}

/** Refuse links, including the directory itself, before reading immutable evidence. */
export function directorySnapshot(path: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const visit = (directory: string) => {
    if (lstatSync(directory).isSymbolicLink()) throw new Error(`refusing archive source symbolic link ${directory}`);
    for (const entry of readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`refusing archive source symbolic link ${target}`);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) {
        const bytes = readFileSync(target), content = bytes.toString("utf8");
        if (!Buffer.from(content, "utf8").equals(bytes)) throw new Error(`unsupported non-UTF-8 archive artifact ${target}`);
        files.push({path: relative(path, target), content});
      }
      else throw new Error(`unsupported archive source entry ${target}`);
    }
  };
  visit(path);
  return files;
}
