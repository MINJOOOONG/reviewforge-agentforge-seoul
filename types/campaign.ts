export type CampaignRequirements = {
  campaignName: string;
  brand: string;
  providedItems: string[];
  recruitmentConditions: string[];
  visitConditions: string[];
  requiredKeywords: string[];
  minimumKeywordCounts: Record<string, number>;
  minimumPhotos: number;
  videoRequired: boolean;
  minimumCharacters: number;
  requiredMentions: string[];
  requiredLinks: string[];
  requiredHashtags: string[];
  deadline: string | null;
  otherRequirements: string[];
  sourceUrl?: string;
};

export type CampaignAnalysisResult = {
  requirements: CampaignRequirements;
  source: {
    provider: "Bright Data";
    mode: "real" | "demo";
    fetchedAt: string;
    pageTitle?: string;
    requestId?: string;
  };
};
