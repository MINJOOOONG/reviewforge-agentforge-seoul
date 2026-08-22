import { z } from "zod";
import { MEDIA_CATEGORIES } from "@/types/media";

const visitConditionsSchema = z.object({
  basePartySize: z.number().int().min(1).max(100).nullable().default(null),
  maxPartySize: z.number().int().min(1).max(100).nullable().default(null),
  additionalPersonFee: z.number().int().min(0).max(100_000_000).nullable().default(null),
  additionalPersonAgeThreshold: z.number().int().min(0).max(100).nullable().default(null),
  petAllowed: z.boolean().nullable().default(null),
  reservationRequired: z.boolean().nullable().default(null),
  availableTimes: z.array(z.string().max(300)).max(30).default([]),
  parkingConditions: z.string().max(500).nullable().default(null),
  companionConditions: z.array(z.string().max(300)).max(30).default([]),
  otherConditions: z.array(z.string().max(500)).max(50).default([]),
}).default({});

const reviewRequirementsSchema = z.object({
  minimumPhotos: z.number().int().min(0).max(100).nullable().default(null),
  minimumVideos: z.number().int().min(0).max(100).nullable().default(null),
  minimumCharacters: z.number().int().min(0).max(100_000).nullable().default(null),
  mapLinkRequired: z.boolean().nullable().default(null),
  requiredLinks: z.array(z.string().max(2_048)).max(20).default([]),
  titleKeywords: z.array(z.string().max(100)).max(30).default([]),
  bodyKeywords: z.array(z.string().max(100)).max(30).default([]),
  customKeywordRequired: z.boolean().nullable().default(null),
  customKeywordCount: z.number().int().min(0).max(30).nullable().default(null),
  minimumKeywordCounts: z.record(z.string().max(100), z.number().int().min(0).max(100)).default({}),
  requiredHashtags: z.array(z.string().max(100)).max(50).default([]),
  otherRequiredMissions: z.array(z.string().max(500)).max(50).default([]),
}).default({});

const keywordRulesSchema = z.object({
  requiredKeywords: z.array(z.string().max(100)).max(30).default([]),
  titleKeywords: z.array(z.string().max(100)).max(30).default([]),
  bodyKeywords: z.array(z.string().max(100)).max(30).default([]),
  customKeywordRequired: z.boolean().nullable().default(null),
  customKeywordCount: z.number().int().min(0).max(30).nullable().default(null),
  minimumOccurrences: z.number().int().min(0).max(100).nullable().default(null),
  appliesToTitle: z.boolean().nullable().default(null),
  appliesToBody: z.boolean().nullable().default(null),
}).default({});

export const campaignRequirementsSchema = z.object({
  campaignName: z.string().max(300).default("캠페인명 미확인"),
  brand: z.string().max(200).default("브랜드 미확인"),
  providedItems: z.array(z.string().max(300)).max(30).default([]),
  recruitmentConditions: z.array(z.string().max(500)).max(30).default([]),
  visitConditions: visitConditionsSchema,
  reviewRequirements: reviewRequirementsSchema,
  keywordRules: keywordRulesSchema,
  selectionBoosters: z.array(z.object({
    type: z.string().max(100),
    description: z.string().max(500),
    required: z.literal(false).default(false),
  })).max(30).default([]),
  conditionalRequirements: z.array(z.object({
    condition: z.string().max(200),
    requirement: z.string().max(500),
    requiredHashtag: z.string().max(100).nullable().default(null),
    position: z.string().max(100).nullable().default(null),
  })).max(30).default([]),
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
