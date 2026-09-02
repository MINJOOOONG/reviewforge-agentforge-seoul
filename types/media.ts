export const MEDIA_CATEGORIES = [
  "hero",
  "food",
  "menu",
  "exterior",
  "interior",
  "product",
  "before",
  "after",
  "atmosphere",
  "other",
] as const;

export const MAX_MEDIA_UPLOADS = 15;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export type MediaAnalysis = {
  fileName: string;
  category: MediaCategory;
  qualityScore: number;
  relevanceScore: number;
  caption?: string;
};

export type MediaAnalysisResult = {
  items: MediaAnalysis[];
  source: {
    provider: "Local Engine";
    mode: "real" | "demo" | "local";
    workloadId?: string;
    model?: string;
    analyzedAt: string;
  };
};
