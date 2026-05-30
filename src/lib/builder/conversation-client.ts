"use client";

import {
  ensureRoom,
  postMessage,
  type AuthenticatedFetch,
} from "@/lib/solid/chat";
import { projectRoomUrl, podRootFromWebId } from "@/lib/solid/pod";
import type { MessageKind } from "./types";

/** foaf:maker IRI for builder-authored (status / preview / question) messages. */
export const BUILDER_AGENT = "https://mind.dev/builder#agent";

/** Active states where the status poller should keep running. */
export const ACTIVE_STATUSES = new Set([
  "creating-repo",
  "scaffolding",
  "issue-created",
  "coder-running",
  "merging",
  "building",
]);

export function roomFor(webid: string, slug: string): string {
  return projectRoomUrl(podRootFromWebId(webid), slug);
}

/** Ensure the project room exists, then append a message of the given kind. */
export async function writeMessage(
  fetch: AuthenticatedFetch,
  webid: string,
  slug: string,
  args: { body: string; kind: MessageKind; previewUrl?: string; author?: string },
): Promise<void> {
  const roomUrl = roomFor(webid, slug);
  await ensureRoom(roomUrl, slug, webid, fetch);
  await postMessage(
    roomUrl,
    {
      body: args.body,
      author: args.author ?? BUILDER_AGENT,
      kind: args.kind,
      previewUrl: args.previewUrl,
    },
    fetch,
  );
}
