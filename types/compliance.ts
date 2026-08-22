export type ComplianceStatus = "PASS" | "WARNING" | "FAIL";

export type ComplianceCheck = {
  name: string;
  status: ComplianceStatus;
  detail: string;
};

export type ComplianceResult = {
  score: number;
  checks: ComplianceCheck[];
  summary: {
    pass: number;
    warning: number;
    fail: number;
  };
  source: {
    provider: "Daytona";
    mode: "real" | "demo";
    sandboxId?: string;
    executedAt: string;
    durationMs?: number;
  };
};
