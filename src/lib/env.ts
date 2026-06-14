/**
 * Single source of truth for environment configuration.
 *
 * Split into two groups:
 *   - Client-safe (`NEXT_PUBLIC_*`): inlined at build time, readable in the
 *     browser. Changing them needs a dev-server restart + hard reload.
 *   - Server-only: read at runtime inside API routes / scripts. Never import
 *     these into a "use client" module.
 */

// ---- Client-safe (NEXT_PUBLIC_*) ------------------------------------------

export const oidcIssuer =
  process.env.NEXT_PUBLIC_SOLID_ISSUER ??
  process.env.NEXT_PUBLIC_OIDC_ISSUER ??
  "https://pods.mindpods.org/";

export const bridgeUrl = trimSlash(
  process.env.NEXT_PUBLIC_CODESPACES_BRIDGE_URL ?? "http://localhost:3010",
);

export const podBaseUrl = ensureSlash(
  process.env.NEXT_PUBLIC_POD_BASE_URL ?? "http://localhost:3011/",
);

// ---- Server-only ----------------------------------------------------------

export type BridgeMode = "dev" | "delegated";

export const bridgeMode: BridgeMode =
  process.env.BUILDER_BRIDGE_MODE === "delegated" ? "delegated" : "dev";

// Shared secret for the bridge's trusted-service auth. When set, the builder
// server authenticates to the bridge as the requesting WebID via
// X-Mind-Service-Secret + X-Mind-On-Behalf-Of — the production path (the dev
// X-Mind-Dev-WebId header is ignored by a prod bridge). Server-only.
export const bridgeServiceSecret =
  process.env.BUILDER_BRIDGE_SERVICE_SECRET?.trim() || null;

export const indexerDataDir =
  process.env.INDEXER_DATA_DIR ?? "./.builder-data";

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function ensureSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
