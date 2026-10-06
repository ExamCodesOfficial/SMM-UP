export interface ApiPayload {
  error?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Reads an API response without mislabelling a non-JSON server failure as a
 * browser network outage. Provider/platform error pages are never shown raw.
 */
export async function readApiPayload(
  response: Response,
  fallbackError = "The service is temporarily unavailable. Please try again.",
  maxBytes = 5_000_000,
): Promise<ApiPayload> {
  const contentType = response.headers.get("content-type") || "";
  const declaredLength = Number(response.headers.get("content-length") || 0);
  const safeLimit = Math.max(16_000, Math.min(Math.trunc(maxBytes), 5_000_000));
  if (contentType.toLowerCase().includes("application/json") && declaredLength <= safeLimit) {
    try {
      const text = await response.text();
      if (text.length <= safeLimit) {
        const payload = JSON.parse(text);
        if (payload && typeof payload === "object") return payload as ApiPayload;
      }
    } catch {
      // Fall through to a bounded, non-sensitive message.
    }
  }

  return {
    error: response.ok
      ? "The server returned an invalid response. Please try again."
      : `${fallbackError} (HTTP ${response.status})`,
  };
}
