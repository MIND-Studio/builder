"use client";

import { podRootFromWebId } from "@mind-studio/core/apps";
import { MindAppLauncher } from "@mind-studio/core/launcher";
import { Badge, Button, Card, CardContent } from "@mind-studio/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiSettings } from "@/components/AiSettings";
import { Composer } from "@/components/Composer";
import { ACTIVE_STATUSES, writeMessage } from "@/lib/builder/conversation-client";
import type { Project, ProjectStatus } from "@/lib/builder/types";
import { usePodConnection } from "@/lib/builder/use-connection";
import { useSession } from "@/lib/solid/session";
import { humanizeSlug } from "@/lib/util/slug";

const SUGGESTIONS = [
  "A website for my honey from my bees",
  "A focus timer to help me get things done",
  "A simple page with all my links",
  "A tic-tac-toe game",
];

/** A friendly label + Badge variant for a project's current status. */
function statusBadge(status: ProjectStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  switch (status) {
    case "published":
      return { label: "Ready", variant: "default" };
    case "error":
      return { label: "Needs a fix", variant: "destructive" };
    case "awaiting-user":
      return { label: "Your turn", variant: "outline" };
    default:
      return { label: "Building…", variant: "secondary" };
  }
}

export default function BuildIndexPage() {
  const { webid, loggedIn, loading, fetch: solidFetch, signOut } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connected, connect, busy: connecting } = usePodConnection(webid);

  useEffect(() => {
    if (!loading && !loggedIn) router.replace("/");
  }, [loading, loggedIn, router]);

  const reconciledRef = useRef(false);

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    if (!webid) return [];
    const res = await fetch("/api/projects", { headers: { "x-mind-webid": webid } });
    if (!res.ok) return [];
    const data = (await res.json()) as { projects: Project[] };
    setProjects(data.projects);
    return data.projects;
  }, [webid]);

  // On first load, reconcile any project still showing an active status. A
  // build that finished after its tab was closed leaves the cached status
  // frozen at "Building…"; without this the dashboard would show that stale
  // state until the user opened the project. Reconcile advances each to the
  // truth (Ready / Needs a fix), then refresh the badges. Runs once per mount.
  useEffect(() => {
    if (!webid || reconciledRef.current) return;
    reconciledRef.current = true;
    void (async () => {
      const list = await loadProjects();
      const stale = list.filter((p) => ACTIVE_STATUSES.has(p.status));
      if (!stale.length) return;
      await Promise.all(
        stale.map((p) =>
          fetch(`/api/projects/${p.slug}/status`, {
            method: "POST",
            headers: { "x-mind-webid": webid },
          }).catch(() => null),
        ),
      );
      await loadProjects();
    })();
  }, [webid, loadProjects]);

  const onWish = useCallback(
    async (wish: string) => {
      if (!webid || !solidFetch) return;
      setCreating(true);
      setError(null);
      try {
        const res = await fetch("/api/wish", {
          method: "POST",
          headers: { "content-type": "application/json", "x-mind-webid": webid },
          body: JSON.stringify({ text: wish }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Couldn’t start that build (${res.status})`);
        }
        const data = (await res.json()) as { project: Project; statusBody: string };
        const slug = data.project.slug;
        // Seed the conversation with the wish + first status.
        await writeMessage(solidFetch, webid, slug, {
          body: wish,
          kind: "user-wish",
          author: webid,
        });
        await writeMessage(solidFetch, webid, slug, { body: data.statusBody, kind: "status" });
        router.push(`/build/${slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        setCreating(false);
      }
    },
    [webid, solidFetch, router],
  );

  if (loading || !loggedIn) {
    return <main className="mx-auto max-w-2xl px-6 py-16 text-muted-foreground">Loading…</main>;
  }

  const firstName = webid ? humanizeOwner(webid) : "there";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <header className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-lg text-primary-foreground shadow-sm">
            ✦
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hi {firstName} 👋</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              What would you like to build today?
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <MindAppLauncher
            podRoot={webid ? podRootFromWebId(webid) : undefined}
            podFetch={solidFetch}
          />
          <AiSettings webid={webid} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut().then(() => router.replace("/"))}
          >
            Sign out
          </Button>
        </div>
      </header>

      {connected === false ? (
        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">
              One quick step
            </div>
            <p className="mt-1.5 text-sm text-foreground">
              Let Mind Builder save the things you make to your own private space. You’ll approve it
              just once — no extra password, and it’s remembered next time.
            </p>
            <Button onClick={connect} disabled={connecting} className="mt-3">
              {connecting ? "Waiting for your approval…" : "Allow & continue"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Composer
            onSend={onWish}
            disabled={creating || connected === false}
            placeholder={
              connected === false
                ? "Finish the quick step above to start building…"
                : "e.g. a friendly website for my honey from my bees…"
            }
          />
        </CardContent>
      </Card>

      {!creating && connected !== false && projects.length === 0 ? (
        <div className="mt-4">
          <p className="mb-2 px-1 text-[13px] text-muted-foreground">
            Not sure where to start? Try one of these:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void onWish(s)}
                className="rounded-full border bg-card px-3.5 py-1.5 text-[13px] text-foreground transition hover:border-primary hover:bg-primary/5"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {creating ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <span className="soft-pulse inline-block size-2 rounded-full bg-primary" />
          Setting up your project… this only takes a moment.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-center text-[13px] text-destructive">{error}</p> : null}

      <section className="mt-12">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Your projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet — your builds will show up in this list.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => {
              const badge = statusBadge(p.status);
              return (
                <li key={p.slug}>
                  <Link href={`/build/${p.slug}`} className="block">
                    <Card className="transition hover:border-primary/50 hover:shadow-sm">
                      <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {humanizeSlug(p.slug)}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.slug}
                          </span>
                        </span>
                        <Badge variant={badge.variant} className="shrink-0">
                          {badge.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

/** Friendly first-name-ish label from a WebID's owner segment. */
function humanizeOwner(webid: string): string {
  try {
    const seg = new URL(webid).pathname.split("/").filter(Boolean)[0] ?? "";
    if (!seg) return "there";
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  } catch {
    return "there";
  }
}
