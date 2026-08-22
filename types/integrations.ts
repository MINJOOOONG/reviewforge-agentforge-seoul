export type IntegrationName = "brightData" | "nosana" | "qwen" | "daytona";
export type IntegrationState = "connected" | "configured" | "missing" | "unavailable" | "demo";

export type IntegrationHealth = {
  name: IntegrationName;
  label: string;
  state: IntegrationState;
  detail: string;
  checkedAt: string;
};
