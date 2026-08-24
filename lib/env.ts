export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}
