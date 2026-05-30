"use client";

import Link from "next/link";
import { ConnectionStatus, type ConnState } from "./ConnectionStatus";

/** Split workspace: the conversation on the left, the live preview on the right. */
export function BuildLayout({
  title,
  connState,
  left,
  right,
}: {
  title: string;
  connState: ConnState;
  left: React.ReactNode;
  right: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div className="flex items-center gap-3">
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
        <ConnectionStatus state={connState} />
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,2fr)_3fr]">
        <section className="flex min-h-0 flex-col border-r bg-card">{left}</section>
        <section className="hidden min-h-0 lg:block">{right}</section>
      </div>
    </div>
  );
}
