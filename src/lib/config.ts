/**
 * Client-facing runtime config re-exported from env.ts for ergonomic imports
 * in "use client" components (mirrors the mind-chat-v0 config shape).
 */
export { oidcIssuer, bridgeUrl, podBaseUrl } from "@/lib/env";

/** Display name used by the shared login card + last-identity hint. */
export const APP_NAME = "Builder";

/** Honey-amber accent — distinct from every other sibling prototype. */
export const ACCENT = "#d97706";
