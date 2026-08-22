export type VisitConditions = {
  basePartySize: number | null;
  maxPartySize: number | null;
  additionalPersonFee: number | null;
  additionalPersonAgeThreshold: number | null;
  petAllowed: boolean | null;
  reservationRequired: boolean | null;
  availableTimes: string[];
  parkingConditions: string | null;
  companionConditions: string[];
  otherConditions: string[];
};

export type ReviewRequirements = {
  minimumPhotos: number | null;
  minimumVideos: number | null;
  minimumCharacters: number | null;
  mapLinkRequired: boolean | null;
  requiredLinks: string[];
  titleKeywords: string[];
  bodyKeywords: string[];
  customKeywordRequired: boolean | null;
  customKeywordCount: number | null;
  minimumKeywordCounts: Record<string, number>;
  requiredHashtags: string[];
  otherRequiredMissions: string[];
};

export type KeywordRules = {
  requiredKeywords: string[];
  titleKeywords: string[];
  bodyKeywords: string[];
  customKeywordRequired: boolean | null;
  customKeywordCount: number | null;
  minimumOccurrences: number | null;
  appliesToTitle: boolean | null;
  appliesToBody: boolean | null;
};

export type SelectionBooster = {
  type: string;
  description: string;
  required: false;
};

export type ConditionalRequirement = {
  condition: string;
  requirement: string;
  requiredHashtag: string | null;
  position: string | null;
};

export type CampaignRequirements = {
  campaignName: string;
  brand: string;
  providedItems: string[];
  recruitmentConditions: string[];
  visitConditions: VisitConditions;
  reviewRequirements: ReviewRequirements;
  keywordRules: KeywordRules;
  selectionBoosters: SelectionBooster[];
  conditionalRequirements: ConditionalRequirement[];
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
