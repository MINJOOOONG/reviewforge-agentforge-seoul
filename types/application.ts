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
    provider: "Local Engine";
    mode: "real" | "demo" | "local";
    model: string;
    generatedAt: string;
    requestId?: string;
  };
};
