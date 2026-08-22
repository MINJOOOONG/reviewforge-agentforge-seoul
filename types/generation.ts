export type PhotoOrderItem = {
  fileName: string;
  category: string;
  reason: string;
};

export type GenerationResult = {
  title: string;
  applicationMessage: string;
  blogDraft: string;
  photoOrder: PhotoOrderItem[];
  unverifiedClaims: string[];
  source: {
    provider: "Qwen Cloud";
    mode: "real" | "demo";
    model: string;
    generatedAt: string;
    requestId?: string;
  };
};
