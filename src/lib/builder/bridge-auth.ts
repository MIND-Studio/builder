import "server-only";
import { bridgeMode, bridgeServiceSecret } from "@/lib/env";

/**
 * Build the auth headers the builder server attaches to every codespaces-bridge
 * call so the bridge treats the request as coming from `webId`.
 *
 *   service   — `X-Mind-Service-Secret` + `X-Mind-On-Behalf-Of`. The bridge
 *               accepts this (in prod too) when BRIDGE_SERVICE_SECRET matches.
 *               This is the production path; preferred whenever
 *               BUILDER_BRIDGE_SERVICE_SECRET is set.
 *   dev       — `X-Mind-Dev-WebId`. The bridge honors this only when
 *               NODE_ENV !== production and waives CSRF (see the bridge's
 *               src/lib/auth/session.ts). Local-dev path.
 *   delegated — a real bridge `mc-session` cookie per WebID. Superseded by the
 *               service-secret path; throws if explicitly selected without a
 *               secret, so we never silently send mutations a prod bridge 401s.
 */
export function bridgeAuthHeaders(webId: string): Record<string, string> {
  if (bridgeServiceSecret) {
    return {
      "X-Mind-Service-Secret": bridgeServiceSecret,
      "X-Mind-On-Behalf-Of": webId,
    };
  }
  if (bridgeMode === "delegated") {
    throw new Error(
      "BUILDER_BRIDGE_MODE=delegated requires BUILDER_BRIDGE_SERVICE_SECRET (the implemented prod path) — set it, or use dev mode against a local non-production bridge.",
    );
  }
  return { "X-Mind-Dev-WebId": webId };
}
