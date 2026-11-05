import { lstatSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod/v4";
import { isDeepStrictEqual } from "node:util";
import { dependencyOrder, directorySnapshot } from "./archive-artifacts.js";
import { validateProject, type TrackState } from "./state.js";
import { readSafeArtifact } from "./memory.js";
import { promotionEvidence, type BeforeEvidence, type PromotionFile } from "./promotion-evidence.js";
import type { ReceiptFile } from "./operation-receipts.js";
import type { DependencyContext } from "./dependency-context.js";

export const REFRESH_ARCHIVE_CONTRACT = "<!-- cadre:refresh-archival:v1 -->";
export const selectedTracksSchema = z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const present = (path: string) => { try { lstatSync(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; } };

export function selectRefreshTracks(root: string, selected?: string[], retry = false): string[] {
  if (selected !== undefined) selectedTracksSchema.parse(selected);
  if (retry) {
    if (selected?.length) throw new Error("Review retry cannot archive tracks");
    return [];
  }
  if (selected?.length === 0) return [];
  const validation = validateProject(root);
  const ids = selected === undefined ? dependencyOrder(validation.tracks.filter((track) => track.status === "completed" && track.location === `tracks/${track.id}`)) : [...new Set(selected)];
  if (!ids.length) return [];
  if (validation.errors.length) throw new Error(validation.errors.join("\n"));
  for (const id of ids) {
    const track = validation.tracks.find((track) => track.id === id), state = validation.states.get(id);
    if (!track || track.location !== `tracks/${id}` || state?.status !== "completed" || state.operation != null) throw new Error(`${id} is not an eligible completed track`);
    if (present(join(root, ".cadre/archive", id))) throw new Error(`archive target already exists for ${id}`);
  }
  return ids;
}

export function archivedState(state: TrackState, reference: string): TrackState {
  return {...state, status: "archived", checkpoint: "archived", history: [...(Array.isArray(state.history) ? state.history : []), {action: "archive", commit: reference}]};
}

export function refreshArchiveFiles(root: string, selected: string[], reference: string): ReceiptFile[] {
  return selected.flatMap((id) => directorySnapshot(join(root, ".cadre/tracks", id)).flatMap((file) => [
    {path: `.cadre/archive/${id}/${file.path}`, content: file.path === "state.json" ? json(archivedState(JSON.parse(file.content), reference)) : file.content},
    {path: `.cadre/tracks/${id}/${file.path}`, content: null}
  ]));
}

export function relocateDependencyContext(context: DependencyContext, selected: string[]): DependencyContext {
  const ids = new Set(selected);
  const relocate = (path: string) => path.replace(/^\.cadre\/tracks\/([^/]+)\//, (prefix, id: string) => ids.has(id) ? `.cadre/archive/${id}/` : prefix);
  return {...context, sources: context.sources.map((source) => ({...source, path: relocate(source.path)})).sort((a, b) => a.path.localeCompare(b.path)),
    constraints: context.constraints.map((constraint) => ({...constraint, sources: constraint.sources.map(relocate)}))};
}

/** Validate exact paired moves, using retained originals after any partial promotion. */
export function requireRefreshArchives(root: string, files: PromotionFile[], saved?: BeforeEvidence[], base?: string | null) {
  const project = files.find((file) => file.path === ".cadre/project.json")?.content;
  const history = project ? JSON.parse(project).history : [];
  const entry = history?.at(-1);
  const selected = selectedTracksSchema.parse(entry?.action === "refresh" ? entry.selectedTracks ?? [] : []);
  if (new Set(selected).size !== selected.length) throw new Error("Duplicate refresh archive selection");
  const evidence = promotionEvidence(root, files, saved, base), owned = new Set<string>();
  if (selected.length) {
    const workflow = files.find((file) => file.path === ".cadre/workflow.md")?.content ?? readSafeArtifact(root, ".cadre/workflow.md");
    if (!workflow.includes(REFRESH_ARCHIVE_CONTRACT)) throw new Error("REFRESH_ARCHIVE_ADOPTION_REQUIRED: include the Refresh archival workflow contract in this approved refresh");
    if (!/^op:refresh-/.test(entry.commit ?? "")) throw new Error("Archive moves require their enclosing refresh reference");
  }
  for (const id of selected) {
    const source = `.cadre/tracks/${id}/`, target = `.cadre/archive/${id}/`;
    const removals = files.filter((file) => file.path.startsWith(source));
    const additions = files.filter((file) => file.path.startsWith(target));
    if (!removals.some((file) => file.path === `${source}state.json`) || removals.length !== additions.length) throw new Error(`Refresh requires the complete archive move for ${id}`);
    for (const removal of removals) {
      const path = target + removal.path.slice(source.length), addition = additions.find((file) => file.path === path);
      if (removal.content !== null || !addition || addition.content === null) throw new Error(`Invalid archive move: ${removal.path}`);
      if (addition.before !== undefined ? addition.before !== null : present(join(root, path))) throw new Error(`Archive destination must be fresh: ${path}`);
      const before = evidence.read(removal.path);
      if (removal.path === `${source}state.json`) {
        const previous = JSON.parse(before) as TrackState;
        if (previous.trackId !== id || previous.status !== "completed" || previous.operation != null
          || !isDeepStrictEqual(JSON.parse(addition.content), archivedState(previous, entry.commit))) throw new Error("Refresh must preserve completed track evidence when archiving");
      } else if (addition.content !== before) throw new Error(`Refresh must preserve historical archive bytes: ${path}`);
      owned.add(removal.path); owned.add(path);
    }
    // New files must not be stranded in either directory after approval or interruption.
    for (const parent of [source, target]) if (present(join(root, parent))) {
      for (const file of directorySnapshot(join(root, parent))) if (!owned.has(parent + file.path)) throw new Error(`Archive inventory changed: ${parent}${file.path}`);
    }
  }
  for (const file of files) {
    if (/^\.cadre\/archive\/(?!\.quick\/)/.test(file.path) && !owned.has(file.path)
      || /^\.cadre\/tracks\//.test(file.path) && file.content === null && !owned.has(file.path)) throw new Error(`Refresh cannot delete or archive an unselected artifact: ${file.path}`);
  }
  return {paths: owned, evidence: evidence.retained()};
}
