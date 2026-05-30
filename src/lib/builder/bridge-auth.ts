import "server-only";
import { bridgeMode } from "@/lib/env";

/**
 * Build the auth headers the builder server attaches to every codespaces-bridge
 * call so the bridge treats the request as coming from `webId`.
 *
 *   dev       — `X-Mind-Dev-WebId`. The bridge honors this only when
 *               NODE_ENV !== production and waives CSRF (see the bridge's
 *               src/lib/auth/session.ts). This is the MVP path.
 *   delegated — the builder would hold a real bridge `mc-session` cookie per
 *               WebID (server-to-server `/api/auth/login` or user `/connect`).
 *               Deferred; throws so we never silently send unauthenticated
 *               mutations that the prod bridge would 401.
 */
export function bridgeAuthHeaders(webId: string): Record<string, string> {
  if (bridgeMode === "delegated") {
    throw new Error(
      "BUILDER_BRIDGE_MODE=delegated is not implemented yet — use dev mode against a local non-production bridge.",
    );
  }
  return { "X-Mind-Dev-WebId": webId };
}
