export function providerLog(provider: string, message: string, metadata?: Record<string, unknown>) {
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.info(`[${provider}] ${message}${suffix}`);
}

export function providerError(provider: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${provider}] Failed: ${message}`);
}
