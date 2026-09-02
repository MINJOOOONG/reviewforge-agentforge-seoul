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
    provider: "Local Engine";
    mode: "real" | "demo" | "local";
    model: string;
    generatedAt: string;
    requestId?: string;
  };
};
