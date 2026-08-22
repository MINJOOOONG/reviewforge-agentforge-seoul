export type ApplicationMessageVariant = {
  label: string;
  message: string;
};

export type ApplicationGenerationResult = {
  variants: ApplicationMessageVariant[];
  source: {
    provider: "Qwen Cloud";
    mode: "real" | "demo";
    model: string;
    generatedAt: string;
    requestId?: string;
  };
};
