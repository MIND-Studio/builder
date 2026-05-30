"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, Button } from "@mind-studio/ui";
import { MessageBody } from "./MessageBody";
import type { ChatMessage } from "@/lib/solid/chat";

/** Renders the builder conversation as a friendly chat: your wishes (right),
 *  the builder's replies + "your app is ready" cards (left), and build-progress
 *  notes as a lightweight inline timeline. */
export function Conversation({
  messages,
  busy,
  workingLabel,
}: {
  messages: ChatMessage[];
  busy?: boolean;
  workingLabel?: string;
}): React.JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy, workingLabel]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {messages.map((m) => (
            <li key={m.url}>{renderMessage(m)}</li>
          ))}
        </ul>
      )}
      {busy ? <WorkingIndicator label={workingLabel} /> : null}
      <div ref={endRef} className="h-1" />
    </div>
  );
}

function renderMessage(m: ChatMessage): React.JSX.Element {
  switch (m.kind) {
    case "user-wish":
      return (
        <div className="flex justify-end gap-2.5 py-1">
          <div className="flex min-w-0 max-w-[82%] flex-col items-end">
            <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[14px] text-primary-foreground">
              <MessageBody body={m.body} />
            </div>
            <Time iso={m.createdAtIso} />
          </div>
          <UserAvatar initial={ownerInitial(m.author)} />
        </div>
      );

    case "preview-card":
      return (
        <div className="flex items-start gap-2.5 py-2">
          <AgentAvatar />
          <div className="min-w-0 max-w-[88%] flex-1">
            <div className="overflow-hidden rounded-2xl rounded-bl-md border bg-card shadow-sm">
              <div className="flex items-center gap-2 px-4 pt-3.5">
                <span className="soft-pulse inline-block size-2 rounded-full bg-primary" />
                <span className="text-[11px] font-semibold text-primary">
                  Your app is ready 🎉
                </span>
              </div>
              <p className="px-4 pt-2 text-[14px] leading-relaxed text-foreground">{m.body}</p>
              {m.previewUrl ? (
                <div className="px-4 pb-4 pt-3">
                  <Button asChild size="sm" className="rounded-xl">
                    <a href={m.previewUrl} target="_blank" rel="noopener noreferrer">
                      Open my app <span aria-hidden>↗</span>
                    </a>
                  </Button>
                  <p className="mt-2 truncate text-[11px] text-muted-foreground">
                    {prettyUrl(m.previewUrl)}
                  </p>
                </div>
              ) : null}
            </div>
            <Time iso={m.createdAtIso} />
          </div>
        </div>
      );

    case "agent-question":
      return (
        <div className="flex items-start gap-2.5 py-1">
          <AgentAvatar />
          <div className="flex min-w-0 max-w-[82%] flex-col items-start">
            <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
              Mind Builder
            </span>
            <div className="rounded-2xl rounded-bl-md border bg-muted px-3.5 py-2.5 text-[14px] text-foreground">
              <MessageBody body={m.body} />
            </div>
            <Time iso={m.createdAtIso} />
          </div>
        </div>
      );

    case "status":
    default:
      return (
        <div className="flex items-start gap-2.5 py-1 pl-1">
          <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-primary/40" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{m.body}</p>
        </div>
      );
  }
}

function WorkingIndicator({ label }: { label?: string }): React.JSX.Element {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <AgentAvatar />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border bg-muted px-3.5 py-2.5">
        <span className="flex items-end gap-1" aria-hidden>
          <Dot delay="-0.32s" />
          <Dot delay="-0.16s" />
          <Dot delay="0s" />
        </span>
        <span className="text-[13px] text-muted-foreground">{label ?? "Working on it…"}</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }): React.JSX.Element {
  return (
    <span
      className="inline-block size-1.5 animate-bounce rounded-full bg-primary"
      style={{ animationDelay: delay }}
    />
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-primary text-xl text-primary-foreground">
        ✦
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        Tell me what you’d like to build.
        <br />
        Your app will appear here as I work on it.
      </p>
    </div>
  );
}

function AgentAvatar(): React.JSX.Element {
  return (
    <Avatar className="size-8 shrink-0 rounded-xl">
      <AvatarFallback className="rounded-xl bg-primary text-sm text-primary-foreground">
        ✦
      </AvatarFallback>
    </Avatar>
  );
}

function UserAvatar({ initial }: { initial: string }): React.JSX.Element {
  return (
    <Avatar className="size-8 shrink-0 self-end">
      <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

function Time({ iso }: { iso: string }): React.JSX.Element | null {
  const t = formatTime(iso);
  if (!t) return null;
  return (
    <span className="mt-1 px-1 text-[10px] tabular-nums text-muted-foreground/70">{t}</span>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** First letter of the pod owner segment of a WebID (for the user avatar). */
function ownerInitial(webid: string): string {
  try {
    const seg = new URL(webid).pathname.split("/").filter(Boolean)[0];
    return (seg?.[0] ?? "y").toUpperCase();
  } catch {
    return "Y";
  }
}

/** Drop the scheme + show host/last-segment so the preview link reads cleanly. */
function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
