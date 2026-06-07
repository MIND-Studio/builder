/**
 * Client-facing runtime config re-exported from env.ts for ergonomic imports
 * in "use client" components (mirrors the chat config shape).
 */
export { oidcIssuer, bridgeUrl, podBaseUrl } from "@/lib/env";

import { podBaseUrl as POD_BASE } from "@/lib/env";

/**
 * App-owned feedback inbox (a public-append container the app developer
 * controls). All feedback — from any user, logged in or not — is POSTed here,
 * and the dev reads it from this one place. See `@mind-studio/core/feedback`.
 */
export const feedbackInbox =
  process.env.NEXT_PUBLIC_FEEDBACK_INBOX ?? `${POD_BASE}alice/builder-feedback/`;

/** Display name used by the shared login card + last-identity hint. */
export const APP_NAME = "Builder";

/** Honey-amber accent — distinct from every other sibling prototype. */
export const ACCENT = "#d97706";
