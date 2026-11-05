import { z } from "zod/v4";
import { CadreError } from "./errors.js";
import { contentHash } from "./memory.js";
import { productPathSchema } from "./quick-record.js";
import { QUICK_ARCHIVE } from "./quick-consolidation.js";
import type { QuickEntry } from "./quick-history.js";

export const quickSearchSchema = z.strictObject({
  query: z.string().trim().min(1).max(256).optional(), paths: z.array(productPathSchema).min(1).max(20).optional(),
  limit: z.number().int().min(1).max(10).default(5), cursor: z.string().max(1024).optional()
}).refine((input) => input.query || input.paths?.length, "Quick search requires a query or affected paths");

/** Explicit relevance lookup; no implicit history sweep in the model's context. */
export function searchQuickRecords(records: QuickEntry[], input: z.output<typeof quickSearchSchema>) {
  const words = input.query?.toLowerCase().split(/\s+/) ?? [];
  const matches = records.filter((entry) => entry.status === "completed").map((entry) => {
    const record = entry.record, title = `${record.quickId} ${record.title}`.toLowerCase();
    const text = `${title} ${record.intent} ${record.outcome} ${record.lessons.join(" ")} ${record.affectedPaths.join(" ")}`.toLowerCase();
    const pathMatches = (input.paths ?? []).filter((path) => record.affectedPaths.some((affected) => affected === path || affected.startsWith(`${path}/`) || path.startsWith(`${affected}/`))).length;
    const wordMatches = words.filter((word) => text.includes(word)).length;
    return {entry, score: pathMatches * 100 + wordMatches * 2 + words.filter((word) => title.includes(word)).length};
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.entry.record.quickId.localeCompare(b.entry.record.quickId));
  const digest = contentHash(JSON.stringify({query: input.query, paths: input.paths, matches: matches.map(({entry, score}) => [entry.path, entry.sha256, score])}));
  const cursor = input.cursor ? z.strictObject({digest: z.string(), offset: z.number().int().nonnegative()}).parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString())) : {digest, offset: 0};
  if (cursor.digest !== digest) throw new CadreError("CONTEXT_SNAPSHOT_CHANGED", "Quick search changed; restart without quickSearch.cursor");
  if (cursor.offset > matches.length) throw new Error("Invalid quick search cursor");
  const hits: Array<{quickId: string; title: string; outcomePreview: string; path: string; sha256: string; archived: boolean; hasLessons: boolean}> = [];
  let offset = cursor.offset;
  while (offset < matches.length && hits.length < input.limit) {
    const {entry} = matches[offset]!, record = entry.record;
    const hit = {quickId: record.quickId, title: record.title, outcomePreview: record.outcome.slice(0, 240), path: entry.path,
      sha256: entry.sha256, archived: entry.path.startsWith(`${QUICK_ARCHIVE}/`), hasLessons: record.lessons.length > 0};
    if (Buffer.byteLength(JSON.stringify([...hits, hit])) > 7168) break;
    hits.push(hit); offset++;
  }
  return {hits, totalMatches: matches.length,
    nextSearchCursor: offset === matches.length ? null : Buffer.from(JSON.stringify({digest, offset})).toString("base64url")};
}
