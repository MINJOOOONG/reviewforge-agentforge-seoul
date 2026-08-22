export type ApplicationMessageVariant = {
  label: string;
  message: string;
};

export type ApplicationGenerationResult = {
  variants: ApplicationMessageVariant[];
  businessHighlights: string[];
  researchSources: string[];
  researchQuery?: string;
  source: {
    provider: "Qwen Cloud";
    mode: "real" | "demo";
    model: string;
    generatedAt: string;
    requestId?: string;
  };
};
