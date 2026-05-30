import "server-only";
import {
  createRepo,
  getRepo,
  enablePages,
  mintToken,
  createIssue,
  addComment,
  getIssue,
  listPulls,
  mergePull,
  listRuns,
  listIssueAgentRuns,
  isPublished,
  BridgeError,
} from "./bridge-client";
import { pushScaffold } from "./scaffold";
import {
  getProject,
  upsertProject,
  setStatus,
  getProgress,
  setProgress,
  slugExists,
} from "./db";
import { buildIssueBody, buildIssueTitle, buildAppTitle } from "./prompt";
import { slugifyWish, shortSuffix } from "@/lib/util/slug";
import { bridgeUrl } from "@/lib/env";
import {
  ownerFromWebId,
  podRootFromWebId,
  projectTargetContainer,
  previewUrlFor,
} from "@/lib/solid/pod";
import { STATUS_LABELS, type MessageKind, type Project, type ProjectStatus } from "./types";
import { log } from "@/lib/util/log";

/** An event the server observed that the browser should persist to pod chat. */
export type BuilderEvent = { kind: MessageKind; body: string; previewUrl?: string };

const TERMINAL_RUN = new Set(["success", "failed", "error"]);

function now(): number {
  return Date.now();
}

/** Allocate a slug not already used locally or on the bridge. */
async function allocateSlug(owner: string, wish: string): Promise<string> {
  const base = slugifyWish(wish);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${shortSuffix()}`;
    if (slugExists(slug)) continue;
    const existing = await getRepo(owner, slug);
    if (!existing) return slug;
  }
  // Give up on a clean name; suffix unconditionally.
  return `${base}-${shortSuffix()}`;
}

/**
 * First wish: create repo → enable Pages → push the Vite scaffold → file the
 * wish as an issue (which fires the coder). Returns the new project plus the
 * status message the browser should write into the conversation.
 */
export async function createProject(
  webId: string,
  wish: string,
): Promise<{ project: Project; status: ProjectStatus; statusBody: string }> {
  const owner = ownerFromWebId(webId);
  const podRoot = podRootFromWebId(webId);
  const slug = await allocateSlug(owner, wish);
  const targetContainer = projectTargetContainer(podRoot, slug);
  const pagesUrl = previewUrlFor(targetContainer);
  const appTitle = buildAppTitle(wish);

  log.info({ event: "builder.wish.create", owner, slug }, "creating project");

  await createRepo(webId, {
    owner,
    name: slug,
    ownerWebId: webId,
    ownerPodRoot: podRoot,
    visibility: "public",
  });
  await enablePages(webId, owner, slug, {
    sourceBranch: "main",
    sourcePath: "/",
    targetContainer,
  });
  const { token } = await mintToken(webId, owner, slug, "mind-builder");
  await pushScaffold({ owner, name: slug, token, appTitle });

  const { issue } = await createIssue(webId, owner, slug, {
    title: buildIssueTitle(wish),
    body: buildIssueBody(wish),
    priority: "high",
  });

  const project: Project = {
    slug,
    webId,
    repoOwner: owner,
    repoName: slug,
    pagesUrl,
    targetContainer,
    lastIssue: issue.number,
    status: "coder-running",
    statusDetail: STATUS_LABELS["coder-running"],
    updatedAt: now(),
  };
  upsertProject(project);
  setProgress({
    slug,
    lastRunId: null,
    lastCommentId: null,
    lastPullNumber: null,
    lastPullMerged: false,
    lastPublished: false,
    lastAgentRunId: 0,
  });

  return {
    project,
    status: "coder-running",
    statusBody:
      "🧰 Set up your project and a starter app — you’ll see a placeholder preview on the right in a few seconds. Now the agent is reading your wish and writing the code. This usually takes a minute or two; hang tight and watch here.",
  };
}

/**
 * Follow-up wish. Two cases, decided by whether the current issue is still open:
 *
 *   • Issue still OPEN — the current task hasn't shipped yet (the agent is
 *     working, or asked a clarifying question we're answering). Comment on it
 *     so the coder resumes the SAME `agent/issue-{n}` branch and conversation.
 *
 *   • Issue CLOSED — its PR merged and the change shipped. A fresh request is a
 *     NEW change, so file a NEW issue. The coder branches `agent/issue-{m}` off
 *     `main` (which already has the prior version), edits the existing app, and
 *     opens its own PR. This matches the user's mental model — each new piece of
 *     feedback is its own task, not a comment buried under the first issue.
 */
export async function iterateProject(
  webId: string,
  slug: string,
  wish: string,
): Promise<{ project: Project; status: ProjectStatus; statusBody: string }> {
  const project = getProject(slug);
  if (!project) throw new Error(`unknown project: ${slug}`);
  if (project.webId !== webId) throw new Error("not your project");
  if (project.lastIssue == null) throw new Error("project has no issue thread");

  // Is the current issue still open? A read failure is treated as "open" so we
  // fall back to the safe continue-the-thread path rather than spamming issues.
  let issueOpen = true;
  try {
    const { issue } = await getIssue(project.repoOwner, project.repoName, project.lastIssue);
    issueOpen = issue.status === "open";
  } catch (e) {
    log.warn({ event: "builder.iterate.issue-read-failed", slug, err: String(e) }, "issue read failed");
  }

  if (!issueOpen) {
    // New change → new issue. Use the first-turn body: it's written for
    // "the app already exists, edit it" AND carries the critical rules
    // (React-import, don't touch build files) the short follow-up body omits.
    const { issue } = await createIssue(webId, project.repoOwner, project.repoName, {
      title: buildIssueTitle(wish),
      body: buildIssueBody(wish),
      priority: "high",
    });
    const updated: Project = {
      ...project,
      lastIssue: issue.number,
      status: "coder-running",
      statusDetail: STATUS_LABELS["coder-running"],
      updatedAt: now(),
    };
    upsertProject(updated);
    // Progress counters are global high-water marks (comment/run/pull ids only
    // increase), so they keep working across the issue switch — nothing to reset.
    return {
      project: updated,
      status: "coder-running",
      statusBody:
        "👍 Got it — I opened a new task for that change and the agent is on it. Watch here for the updated preview.",
    };
  }

  // Current task still in flight → continue the same thread.
  await addComment(webId, project.repoOwner, project.repoName, project.lastIssue, buildIssueBody(wish, true));
  setStatus(slug, "coder-running", STATUS_LABELS["coder-running"], now());
  return {
    project: { ...project, status: "coder-running", statusDetail: STATUS_LABELS["coder-running"] },
    status: "coder-running",
    statusBody: "👍 Got it — the agent is updating your app with that change. Watch here for the new preview.",
  };
}

/**
 * Reconcile a project against the bridge and advance the state machine.
 * Returns events the browser should persist to the pod conversation exactly
 * once. Idempotent: progress bookkeeping in sqlite dedupes observations.
 */
export async function reconcile(
  webId: string,
  slug: string,
): Promise<{ project: Project; events: BuilderEvent[] }> {
  const project = getProject(slug);
  if (!project) throw new Error(`unknown project: ${slug}`);
  if (project.webId !== webId) throw new Error("not your project");

  const events: BuilderEvent[] = [];
  if (project.lastIssue == null) return { project, events };

  const owner = project.repoOwner;
  const name = project.repoName;
  const progress = getProgress(slug);
  let status: ProjectStatus = project.status;

  // 1. New agent comments → clarifying questions / notes.
  try {
    const { issue, comments } = await getIssue(owner, name, project.lastIssue);
    const lastSeen = progress.lastCommentId ?? 0;
    const fresh = comments.filter((c) => c.agentRunId != null && c.id > lastSeen);
    for (const c of fresh) {
      events.push({ kind: "agent-question", body: c.body });
      status = "awaiting-user";
    }
    if (comments.length) {
      progress.lastCommentId = Math.max(lastSeen, ...comments.map((c) => c.id));
    }

    // 2. Merge any open PR for this issue (publishing only fires on `main`).
    const { pulls } = await listPulls(owner, name, "open");
    const openForIssue = pulls.filter((p) => p.issueId === issue.id);
    for (const p of openForIssue) {
      try {
        events.push({ kind: "status", body: "🎨 The agent finished a version — adding it to your site and building it…" });
        await mergePull(webId, owner, name, p.number);
        // The bridge's merge writes `main` via a push that fires the
        // post-receive hook, which runs `.mind/workflow.yml` (vite build) and
        // publishes `dist/`. So we must NOT also POST /runs here — that would
        // build twice and surface a duplicate "site ready" card.
        progress.lastPullNumber = p.number;
        progress.lastPullMerged = true;
        status = "building";
      } catch (e) {
        const msg = e instanceof BridgeError ? e.message : String(e);
        events.push({ kind: "status", body: `Couldn’t merge automatically (${msg}). You may need to rephrase or retry.` });
        status = "error";
      }
    }
  } catch (e) {
    log.warn({ event: "builder.reconcile.issue-failed", slug, err: String(e) }, "issue read failed");
  }

  // 3. Workflow builds that finished since last poll → preview card / error.
  //    Collapse ALL new terminal runs into a single observation: a merge
  //    fires the post-receive build, and a fresh project's scaffold push
  //    fires its own — so multiple successful runs can land between polls.
  //    Emitting one card per run produced duplicate "site ready" messages,
  //    so we report once, based on the most recent new terminal run.
  try {
    const { runs } = await listRuns(owner, name);
    const sorted = [...runs].sort((a, b) => a.id - b.id);
    let latest: (typeof sorted)[number] | null = null;
    let handledUpTo = progress.lastRunId ?? 0;
    for (const r of sorted) {
      if (r.id <= (progress.lastRunId ?? 0)) continue;
      if (!TERMINAL_RUN.has(r.status)) break; // stop at first in-flight run; revisit next poll
      latest = r;
      handledUpTo = r.id;
    }
    if (latest) {
      if (latest.status === "success") {
        // publish is the workflow's last step (done before the run is marked
        // success), so the site is already live by the time we see this.
        if (await isPublished(project.targetContainer)) {
          events.push({
            kind: "preview-card",
            body: progress.lastPublished
              ? "✅ Your site is ready — updated with the agent’s work! Preview it on the right."
              : "✨ A starter preview is up on the right while the agent codes your wish. The real version will replace it shortly.",
            previewUrl: project.pagesUrl,
          });
          progress.lastPublished = true;
          status = "published";
        }
      } else {
        const em = latest.errorMessage ?? "";
        // The most common "build failed" in practice is actually a publish
        // failure: the bridge has no delegated write access to this user's
        // pod. Detect it and point them at the bridge's /connect flow.
        if (/delegated identity|seeded fallback|reauthor|OwnerFetchUnavailable|needs-reauthor/i.test(em)) {
          events.push({
            kind: "status",
            body: `Your site built, but the builder isn’t authorized to write to your pod yet. Open ${bridgeUrl}/connect, sign in, and authorize your pod — then send your wish again.`,
          });
        } else {
          events.push({
            kind: "status",
            body: `A build failed${em ? `: ${em.slice(0, 240)}` : ""}. Try rephrasing your wish, or ask the agent to fix the error.`,
          });
        }
        status = "error";
      }
    } else if (status === "building" && !sorted.some((r) => !TERMINAL_RUN.has(r.status))) {
      // Self-heal a wedged "building". `building` means we already merged the
      // PR, so the only real outcomes are published or failed. If no NEW run
      // advanced us above (the build finished while no tab was open to observe
      // it — its run id is now ≤ lastRunId) AND nothing is in flight, derive
      // the truth from the published site + the newest terminal run. Without
      // this, such a project shows "Building…" forever even though its site is
      // live. (Excludes "coder-running": the scaffold publishes early, so
      // isPublished there doesn't mean the wish is done.)
      const newestTerminal = [...sorted].reverse().find((r) => TERMINAL_RUN.has(r.status));
      if (newestTerminal) {
        if (await isPublished(project.targetContainer)) {
          status = "published";
          if (!progress.lastPublished) {
            events.push({
              kind: "preview-card",
              body: "✅ Your site is ready — preview it on the right.",
              previewUrl: project.pagesUrl,
            });
            progress.lastPublished = true;
          }
        } else if (newestTerminal.status !== "success") {
          status = "error";
        }
      }
    }
    progress.lastRunId = handledUpTo;
  } catch (e) {
    log.warn({ event: "builder.reconcile.runs-failed", slug, err: String(e) }, "runs read failed");
  }

  // 4. Coder runs that errored WITHOUT opening a PR or comment (e.g. the
  // opencode container timed out). Without this the UI hangs on "working…"
  // forever, since steps 1–3 see no new pulls/comments/builds.
  try {
    const { runs } = await listIssueAgentRuns(owner, name, project.lastIssue);
    const fresh = runs.filter((rr) => rr.id > progress.lastAgentRunId);
    if (fresh.length) {
      progress.lastAgentRunId = Math.max(progress.lastAgentRunId, ...fresh.map((rr) => rr.id));
      // Only surface a failure if nothing good happened this round (no merge,
      // no published preview) — a successful run already produced a PR/comment.
      const errored = fresh.find((rr) => rr.status === "error");
      if (errored && status !== "published" && status !== "building" && status !== "awaiting-user") {
        const timedOut = /exit 124|timed out|timeout/i.test(errored.summary ?? "");
        events.push({
          kind: "status",
          body: timedOut
            ? "⏱️ The agent ran out of time on that change and didn’t finish. Try again, or split it into a smaller, more specific request."
            : `The agent hit a problem and couldn’t complete that change${errored.errorMessage ? ` (${errored.errorMessage.slice(0, 160)})` : ""}. Try rephrasing or resending your request.`,
        });
        status = "error";
      }
    }
  } catch (e) {
    log.warn({ event: "builder.reconcile.agentruns-failed", slug, err: String(e) }, "agent-runs read failed");
  }

  setProgress(progress);
  setStatus(slug, status, STATUS_LABELS[status], now());

  return { project: { ...project, status, statusDetail: STATUS_LABELS[status] }, events };
}
