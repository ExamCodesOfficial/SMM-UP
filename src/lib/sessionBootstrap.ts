import { readApiPayload } from "./apiResponse";

export type SessionProbeResult =
  | { status: "authenticated"; user: any }
  | { status: "anonymous" }
  | { status: "unavailable" };

interface ProbeOptions {
  fetchImpl?: typeof fetch;
  delaysMs?: number[];
  wait?: (milliseconds: number) => Promise<void>;
}

const DEFAULT_DELAYS_MS = [0, 500, 1_000, 2_000, 4_000, 6_000, 8_000];

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * Resolves the persistent server session without turning deployment/network
 * failures into a false logout. Only an authoritative 401 or successful
 * unauthenticated response is treated as anonymous.
 */
export async function probePersistentSession(options: ProbeOptions = {}): Promise<SessionProbeResult> {
  const fetchImpl = options.fetchImpl || fetch;
  const delaysMs = options.delaysMs?.length ? options.delaysMs : DEFAULT_DELAYS_MS;
  const wait = options.wait || delay;

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    if (delaysMs[attempt] > 0) await wait(delaysMs[attempt]);
    try {
      const response = await fetchImpl("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await readApiPayload(response, "Session service is temporarily unavailable.");

      if (response.ok && payload.authenticated === true && payload.user) {
        return { status: "authenticated", user: payload.user };
      }
      if (response.status === 401 || (response.ok && payload.authenticated === false)) {
        return { status: "anonymous" };
      }
      // Deployment transitions, platform HTML responses, rate limiting and
      // server failures are retried; none are evidence that the cookie expired.
    } catch {
      // A network interruption during deployment is transient, not logout.
    }
  }

  return { status: "unavailable" };
}
