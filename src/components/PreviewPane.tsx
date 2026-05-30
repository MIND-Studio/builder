"use client";

import { useState } from "react";
import { Button } from "@mind-studio/ui";
import type { ProjectStatus } from "@/lib/builder/types";

/** Right-hand live preview: an iframe of the published site, or a friendly
 *  "we're building it" state while the first build is in flight.
 *
 *  `reloadNonce` is bumped by the parent each time a new build publishes
 *  (a preview-card event), so the iframe re-fetches the freshly-built site
 *  instead of showing the stale prior build at the same URL. */
export function PreviewPane({
  pagesUrl,
  status,
  statusDetail,
  reloadNonce = 0,
}: {
  pagesUrl: string | null;
  status: ProjectStatus;
  statusDetail: string;
  reloadNonce?: number;
}): React.JSX.Element {
  const [manualReload, setManualReload] = useState(0);
  const live = status === "published" && !!pagesUrl;
  // Cache-bust so the browser re-fetches index.html (its hashed asset refs
  // change every build) on both auto (publish) and manual reloads.
  const version = reloadNonce + manualReload;
  const src = pagesUrl
    ? `${pagesUrl}${pagesUrl.includes("?") ? "&" : "?"}v=${version}`
    : null;

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-2 truncate text-xs font-medium text-muted-foreground">
          <span
            className="soft-pulse inline-block size-2 rounded-full"
            style={{ background: "var(--primary)" }}
          />
          <span className="truncate text-foreground">
            {live ? "Your app — live" : statusDetail}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pagesUrl ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setManualReload((k) => k + 1)}>
                Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={pagesUrl} target="_blank" rel="noopener noreferrer">
                  Open ↗
                </a>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative flex-1 bg-white">
        {live ? (
          // allow-modals: generated apps (esp. games) commonly use
          // alert()/confirm()/prompt() (e.g. a "Game Over!" message); without
          // it the browser silently ignores those calls in the preview.
          <iframe
            key={version}
            src={src!}
            title="Your app preview"
            className="size-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/30 px-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-2xl">
              <span className="soft-pulse">✦</span>
            </span>
            <p className="max-w-xs text-sm font-medium text-foreground">{statusDetail}</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Your app will appear right here the moment it’s ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
