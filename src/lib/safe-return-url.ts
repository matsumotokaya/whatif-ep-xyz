export function safeLocalUrl(
  origin: string,
  value: unknown,
  fallback: string
): URL {
  const fallbackUrl = new URL(fallback, origin);
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallbackUrl;
  }

  try {
    const candidate = new URL(value, origin);
    return candidate.origin === fallbackUrl.origin ? candidate : fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}
