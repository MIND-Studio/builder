"use client";

import Link from "next/link";
import { ConnectionStatus, type ConnState } from "./ConnectionStatus";

/** Split workspace: the conversation on the left, the live preview on the right.
 *  Below `lg` the preview pane is not rendered, so `previewUrl` (set once the
 *  site is published) surfaces as a header link — without it, phone users have
 *  no way to open their app at all. */
export function BuildLayout({
  title,
  connState,
  previewUrl,
  left,
  right,
}: {
  title: string;
  connState: ConnState;
  previewUrl?: string | null;
  left: React.ReactNode;
  right: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/build"
            className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <span aria-hidden>←</span>
            <span className="grid size-6 place-items-center rounded-lg bg-primary text-[11px] text-primary-foreground">
              ✦
            </span>
            <span className="hidden font-semibold sm:inline">My builds</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mobile-preview-link"
              className="shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted lg:hidden"
            >
              Open my app <span aria-hidden>↗</span>
            </a>
          ) : null}
          <ConnectionStatus state={connState} />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,2fr)_3fr]">
        <section className="flex min-h-0 flex-col border-r bg-card">{left}</section>
        <section className="hidden min-h-0 lg:block">{right}</section>
      </div>
    </div>
  );
}
