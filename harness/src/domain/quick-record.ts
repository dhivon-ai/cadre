import { z } from "zod/v4";

export const quickIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
export const quickPathSchema = z.string().min(1).max(1024).refine((path) => !path.startsWith("/")
  && !/^[a-z]:/i.test(path) && !/[\\\0\r\n]/.test(path) && !path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git"));
export const productPathSchema = quickPathSchema.refine((path) => path.split("/")[0]?.toLowerCase() !== ".cadre");
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const text = z.string().trim().min(1).max(4096);
const file = z.strictObject({ sha256: digest, mode: z.enum(["100644", "100755"]) }).nullable();
export const quickProductSchema = z.strictObject({
  baseCommit: z.string().regex(/^[0-9a-f]{40}$/), verificationDigest: digest,
  changes: z.array(z.strictObject({path: productPathSchema, before: file, after: file})).min(1).max(200)
});
export const quickRecordSchema = z.strictObject({
  schemaVersion: z.literal(1), quickId: quickIdSchema, title: z.string().trim().min(1).max(160),
  intent: text, outcome: text, acceptance: z.array(text).min(1).max(20),
  affectedPaths: z.array(productPathSchema).min(1).max(200),
  verification: z.array(z.strictObject({check: text, result: z.literal("passed"), evidence: text})).min(1).max(30),
  reviewed: z.literal(true),
  context: z.array(z.strictObject({path: quickPathSchema.refine((path) => path.startsWith(".cadre/")), sha256: digest})).max(200),
  lessons: z.array(text).max(20).default([]), relatedQuickIds: z.array(quickIdSchema).max(20).default([]),
  operation: z.string().regex(/^op:quick-[a-z0-9-]+$/).nullable(), product: quickProductSchema.optional()
}).refine((record) => new Set(record.affectedPaths).size === record.affectedPaths.length, "Duplicate affected paths")
  .refine((record) => new Set(record.context.map((source) => source.path)).size === record.context.length, "Duplicate context sources");
export type QuickRecord = z.infer<typeof quickRecordSchema>;
export type QuickProduct = z.infer<typeof quickProductSchema>;
export const QUICK_CONTRACT = "<!-- cadre:quick:v1 -->";
