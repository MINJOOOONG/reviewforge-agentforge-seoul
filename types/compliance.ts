export type ComplianceStatus = "PASS" | "WARNING" | "FAIL" | "OPTIONAL" | "NA";

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
    provider: "Local Engine";
    mode: "real" | "demo" | "local";
    sandboxId?: string;
    executedAt: string;
    durationMs?: number;
  };
};
