"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuildLayout } from "@/components/BuildLayout";
import { Composer } from "@/components/Composer";
import type { ConnState } from "@/components/ConnectionStatus";
import { Conversation } from "@/components/Conversation";
import { PreviewPane } from "@/components/PreviewPane";
import { ACTIVE_STATUSES, roomFor, writeMessage } from "@/lib/builder/conversation-client";
import type { Project } from "@/lib/builder/types";
import { type ChatMessage, listAllMessages } from "@/lib/solid/chat";
import { subscribeToRoom } from "@/lib/solid/chat-subscription";
import { useSession } from "@/lib/solid/session";
import { humanizeSlug } from "@/lib/util/slug";

type StatusEvent = { kind: ChatMessage["kind"]; body: string; previewUrl?: string };

const POLL_MS = 2_500;
const IDLE_POLL_MS = 8_000;

export default function ProjectPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { webid, loggedIn, loading, fetch: solidFetch } = useSession();

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [busy, setBusy] = useState(false);
  // Bumped on every new publish so the preview iframe re-fetches the fresh build.
  const [previewNonce, setPreviewNonce] = useState(0);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!loading && !loggedIn) router.replace("/");
  }, [loading, loggedIn, router]);

  const reload = useCallback(async () => {
    if (!webid || !solidFetch) return;
    const msgs = await listAllMessages(roomFor(webid, slug), solidFetch);
    setMessages(msgs);
  }, [webid, solidFetch, slug]);

  // One reconcile pass: ask the server to advance the build, persist any new
  // events into the pod conversation, and update the local project status.
  const reconcileOnce = useCallback(async () => {
    if (!webid || !solidFetch || inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/projects/${slug}/status`, {
        method: "POST",
        headers: { "x-mind-webid": webid },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { project: Project; events: StatusEvent[] };
      setProject(data.project);
      for (const ev of data.events) {
        await writeMessage(solidFetch, webid, slug, {
          body: ev.body,
          kind: ev.kind,
          previewUrl: ev.previewUrl,
        });
      }
      // A new build published → refresh the preview iframe to the fresh build.
      if (data.events.some((e) => e.kind === "preview-card")) {
        setPreviewNonce((n) => n + 1);
      }
      if (data.events.length) await reload();
      return data.project;
    } finally {
      inFlightRef.current = false;
    }
  }, [webid, solidFetch, slug, reload]);

  // Self-pacing poll loop. We keep polling for the lifetime of the page —
  // fast while a build is active, slow when idle — rather than stopping at the
  // first "published". Stopping was a bug: the scaffold publishes early (status
  // = published) while the coding agent is still working, so we'd miss the
  // agent's PR → merge → rebuild and the preview would never update to the
  // real app.
  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    const tick = async () => {
      const p = await reconcileOnce();
      const delay = p && ACTIVE_STATUSES.has(p.status) ? POLL_MS : IDLE_POLL_MS;
      pollRef.current = setTimeout(tick, delay);
    };
    pollRef.current = setTimeout(tick, POLL_MS);
  }, [reconcileOnce]);

  // Subscribe to the pod conversation + kick off the initial reconcile/poll.
  useEffect(() => {
    if (!webid || !solidFetch) return;
    let handle: { disconnect: () => void } | null = null;
    let disposed = false;
    (async () => {
      await reload();
      handle = await subscribeToRoom(roomFor(webid, slug), solidFetch, reload, setConnState);
      await reconcileOnce();
      // Always keep watching — the agent may still be working even when the
      // current status reads "published" (the early scaffold publish).
      if (!disposed) schedulePoll();
    })();
    return () => {
      disposed = true;
      handle?.disconnect();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [webid, solidFetch, slug, reload, reconcileOnce, schedulePoll]);

  const onWish = useCallback(
    async (wish: string) => {
      if (!webid || !solidFetch) return;
      setBusy(true);
      try {
        await writeMessage(solidFetch, webid, slug, {
          body: wish,
          kind: "user-wish",
          author: webid,
        });
        const res = await fetch("/api/wish", {
          method: "POST",
          headers: { "content-type": "application/json", "x-mind-webid": webid },
          body: JSON.stringify({ slug, text: wish }),
        });
        if (res.ok) {
          const data = (await res.json()) as { project: Project; statusBody: string };
          setProject(data.project);
          await writeMessage(solidFetch, webid, slug, { body: data.statusBody, kind: "status" });
        } else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          await writeMessage(solidFetch, webid, slug, {
            body: `Couldn’t start that change: ${data.error ?? res.status}`,
            kind: "status",
          });
        }
        await reload();
        schedulePoll();
      } finally {
        setBusy(false);
      }
    },
    [webid, solidFetch, slug, reload, schedulePoll],
  );

  if (loading || !loggedIn) {
    return <main className="mx-auto max-w-2xl px-6 py-16 text-muted-foreground">Loading…</main>;
  }

  const status = project?.status ?? "coder-running";
  const statusDetail = project?.statusDetail ?? "Working…";
  const pagesUrl = project?.pagesUrl ?? null;
  const active = ACTIVE_STATUSES.has(status);

  const workingLabel = busy ? "Sending…" : active ? statusDetail : undefined;

  return (
    <BuildLayout
      title={humanizeSlug(slug)}
      connState={connState}
      previewUrl={status === "published" ? pagesUrl : null}
      left={
        <>
          <Conversation messages={messages} busy={busy || active} workingLabel={workingLabel} />
          <Composer onSend={onWish} disabled={busy} placeholder="Tell me what to change…" />
        </>
      }
      right={
        <PreviewPane
          pagesUrl={pagesUrl}
          status={status}
          statusDetail={statusDetail}
          reloadNonce={previewNonce}
        />
      }
    />
  );
}
