import { z } from "zod";
import { MEDIA_CATEGORIES } from "@/types/media";

export const campaignRequirementsSchema = z.object({
  campaignName: z.string().max(300).default("캠페인명 미확인"),
  brand: z.string().max(200).default("브랜드 미확인"),
  providedItems: z.array(z.string().max(300)).max(30).default([]),
  recruitmentConditions: z.array(z.string().max(500)).max(30).default([]),
  visitConditions: z.array(z.string().max(500)).max(30).default([]),
  requiredKeywords: z.array(z.string().max(100)).max(30).default([]),
  minimumKeywordCounts: z.record(z.string().max(100), z.number().int().min(0).max(100)).default({}),
  minimumPhotos: z.number().int().min(0).max(100).default(0),
  videoRequired: z.boolean().default(false),
  minimumCharacters: z.number().int().min(0).max(100_000).default(0),
  requiredMentions: z.array(z.string().max(300)).max(30).default([]),
  requiredLinks: z.array(z.string().max(2_048)).max(20).default([]),
  requiredHashtags: z.array(z.string().max(100)).max(50).default([]),
  deadline: z.string().max(100).nullable().default(null),
  otherRequirements: z.array(z.string().max(500)).max(50).default([]),
});

export const mediaAnalysisSchema = z.object({
  fileName: z.string(),
  category: z.enum(MEDIA_CATEGORIES),
  qualityScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  caption: z.string().optional(),
});

export const generationSchema = z.object({
  title: z.string(),
  applicationMessage: z.string(),
  blogDraft: z.string(),
  photoOrder: z.array(
    z.object({
      fileName: z.string(),
      category: z.string(),
      reason: z.string(),
    }),
  ),
  unverifiedClaims: z.array(z.string()).max(30).default([]),
});

export function parseJsonFromModel<Schema extends z.ZodTypeAny>(raw: string, schema: Schema): z.output<Schema> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Model response did not contain a JSON object");
  }
  return schema.parse(JSON.parse(candidate.slice(firstBrace, lastBrace + 1))) as z.output<Schema>;
}
