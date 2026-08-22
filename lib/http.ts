import { NextResponse } from "next/server";

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status = 502,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function apiError(error: unknown) {
  if (error instanceof ProviderError) {
    return NextResponse.json(
      {
        error: error.message,
        provider: error.provider,
        details: error.details,
      },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs = 45_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}
