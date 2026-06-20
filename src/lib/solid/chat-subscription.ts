"use client";

import { log } from "@/lib/util/log";
import { type AuthenticatedFetch, dayFileUrl, ensureTodayFile } from "./chat";

export type SubscriptionState = "connecting" | "connected" | "polling" | "error";
export type SubscriptionHandle = { disconnect: () => void };

const POLL_INTERVAL_MS = 2_000;

/**
 * Discover the WebSocketChannel2023 subscription endpoint for a topic. CSS v7
 * uniformly exposes it at the origin's /.notifications/WebSocketChannel2023/;
 * we confirm via the storage-description doc but fall back to that path.
 */
async function discoverSubscriptionEndpoint(
  topicUrl: string,
  fetch: AuthenticatedFetch,
): Promise<string> {
  const fallback = `${new URL(topicUrl).origin}/.notifications/WebSocketChannel2023/`;
  try {
    const head = await fetch(topicUrl, { method: "HEAD" });
    const link = head.headers.get("link") ?? "";
    const m = link.match(
      /<([^>]+)>\s*;\s*rel="http:\/\/www\.w3\.org\/ns\/solid\/terms#storageDescription"/,
    );
    if (!m?.[1]) return fallback;
    const descRes = await fetch(m[1], { headers: { accept: "application/ld+json" } });
    if (!descRes.ok) return fallback;
    const desc = (await descRes.json()) as Array<Record<string, unknown>>;
    for (const node of desc) {
      const channelType = (node["http://www.w3.org/ns/solid/notifications#channelType"] ??
        []) as Array<{ "@id"?: string }>;
      if (
        channelType.some(
          (c) => c["@id"] === "http://www.w3.org/ns/solid/notifications#WebSocketChannel2023",
        )
      ) {
        const id = node["@id"];
        if (typeof id === "string") return id;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function openSubscription(
  topicUrl: string,
  fetch: AuthenticatedFetch,
  onMessage: () => void,
  onClose: () => void,
): Promise<{ close: () => void }> {
  const subscribeUrl = await discoverSubscriptionEndpoint(topicUrl, fetch);
  const subRes = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "content-type": "application/ld+json" },
    body: JSON.stringify({
      "@context": ["https://www.w3.org/ns/solid/notification/v1"],
      type: "http://www.w3.org/ns/solid/notifications#WebSocketChannel2023",
      topic: topicUrl,
    }),
  });
  if (!subRes.ok) {
    throw new Error(`subscription POST failed (${subRes.status})`);
  }
  const subBody = (await subRes.json()) as { receiveFrom?: string };
  if (!subBody.receiveFrom) throw new Error("subscription response missing receiveFrom");

  const ws = new WebSocket(subBody.receiveFrom);
  ws.addEventListener("message", () => onMessage());
  ws.addEventListener("close", () => onClose());
  ws.addEventListener("error", () => onClose());
  return {
    close() {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Subscribe to today's chat.ttl; fire `onChange` on any change. Falls back to
 * 2-second polling if the WebSocket can't be established or drops.
 */
export async function subscribeToRoom(
  roomUrl: string,
  fetch: AuthenticatedFetch,
  onChange: () => void,
  onState?: (s: SubscriptionState) => void,
): Promise<SubscriptionHandle> {
  await ensureTodayFile(roomUrl, fetch);
  const topicUrl = dayFileUrl(roomUrl);
  onState?.("connecting");

  let subscription: { close: () => void } | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  function startPolling() {
    if (pollTimer || disposed) return;
    onState?.("polling");
    pollTimer = setInterval(onChange, POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  try {
    subscription = await openSubscription(
      topicUrl,
      fetch,
      () => onChange(),
      () => {
        if (!disposed) startPolling();
      },
    );
    onState?.("connected");
    onChange();
  } catch (err) {
    log.warn({ event: "builder.subscription.connect-failed", err: String(err) }, "ws failed");
    onState?.("error");
    startPolling();
  }

  return {
    disconnect() {
      disposed = true;
      subscription?.close();
      stopPolling();
    },
  };
}
