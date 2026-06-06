# This is NOT the Next.js you know

This version (16.2.6) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# builder — agent rules

A lovable.dev-style **"wish an app"** chat builder on Solid. A user chats a wish
("build me a landing page for my honey from my bees"); a coding agent builds it;
a live preview link appears in the conversation.

## Design system & voice (don't regress)

The UI uses the shared **`@mind-studio/ui`** design system on the **default Mind brand**
(teal-green primary), **dark** default, NOT bespoke CSS. Wiring: `globals.css` does
`@import "../../node_modules/@mind-studio/ui/dist/styles.css"` (a real path — the
`@mind-studio/ui/styles.css` exports subpath does NOT resolve under Tailwind v4) +
`@source "../../node_modules/@mind-studio/ui/dist"`; `layout.tsx` sets
`<html data-mind-theme="mind">` and wraps in `<ThemeProvider theme={mind}
defaultTheme="dark" enableSystem={false} storageKey="mind-builder-theme-v2">`
(bump the storageKey if you change the default so stale localStorage doesn't
win). Build UI from `@mind-studio/ui` components
(`Button`, `Card`, `Badge`, `Textarea`, `Avatar`, …) + semantic token classes
(`bg-primary`, `text-muted-foreground`, `border`, …) — do NOT reintroduce the old
`--honey-*`/`.glass` tokens. `@mind-studio/ui` (and `@mind-studio/core`) install
from **GitHub Packages** (registry deps, `package.json` pins `^0.1.0`); a committed
`.npmrc` scopes `@mind-studio` to `npm.pkg.github.com` — export a token with
`read:packages` (`export NODE_AUTH_TOKEN=<PAT>`) before `npm install`. To iterate
on the shared UI locally, bump+publish it, or `npm install` a local `npm pack`
tarball as a temporary override.

**Voice = for everyone, non-technical.** User-facing copy never says pod, Solid,
repo, PR, agent, issue, Vite, deploy, or bridge. Plain words: "your app",
"build it", "your own private space", "your app is ready".

## The one rule that defines this prototype

**This app does not generate code. It orchestrates the `codespaces`
bridge, which already has the entire build engine** — repo creation, an
issue-driven opencode coder agent (in Docker), a `.mind/workflow.yml` build
runner, PR/merge, and Solid-Pod "Pages" publishing that yields a public preview
URL. builder owns the chat UI, the project model, and pod conversation
storage. The bridge stays the single source of truth for repos/coder/builds.
**Never reimplement git, the coder, the runner, or the publisher here.**

## Architecture (hybrid; server-side proxy)

- The browser holds an Inrupt **pod** session — used ONLY for pod reads/writes
  (chat.ttl, project.ttl).
- **All bridge calls go through this app's own Next.js API routes (server-side).**
  Browser→builder is same-origin (no CORS); the server attaches the bridge's
  dev auth header. Do NOT call the bridge directly from the browser — the
  bridge's `src/proxy.ts` never sends `Access-Control-Allow-Credentials`, so
  credentialed browser→bridge calls are blocked by design.
- Bridge auth in dev = `X-Mind-Dev-WebId: <webid>` (the bridge honors it when
  `NODE_ENV !== production` and waives CSRF — see the bridge's
  `src/lib/auth/session.ts`). Production "delegated" mode (server holds a bridge
  `mc-session` per WebID) is deferred.

## The wish → build → preview loop (orchestrator)

1. First wish → slugify → `POST /api/repos` → `PUT .../pages`
   (`targetContainer = {podRoot}public/sites/{slug}/`).
2. Mint a push token (`POST .../tokens`), push a **Vite + React + Tailwind
   scaffold** (incl. `.mind/workflow.yml` → `run: npm ci / npm run build`,
   `publish: dist`) to `main`. We seed the scaffold ourselves so the free-tier
   coder only writes app content, not tooling.
3. `POST .../issues` with the wish → fires the coder (commits to
   `agent/issue-{n}`, opens a PR).
4. Poll `GET .../pulls` + `.../issues/{n}/comments`: a new PR = done; an agent
   comment (carries `agentRunId`) = clarifying question → surface in chat.
5. `POST .../pulls/{n}/merge` → push to `main` → post-receive builds + publishes.
6. Poll `GET .../runs` then `HEAD {targetContainer}index.html` until 200 → post
   a preview card to chat; render it in the right-pane iframe.
7. Iterate: follow-up wish → `POST .../issues/{n}/comments` → coder resumes the
   same branch (non-fast-forward-safe) → new PR → merge → republish.

**Publishing only fires on a push to the Pages `sourceBranch` (`main`).** The
coder works on `agent/issue-{n}`, so the orchestrator MUST merge the PR to
trigger a build. (Verified in the bridge's `post-receive` route + runner.)

**Merge DOES build — do NOT also `triggerRun`.** The bridge's merge
(`src/lib/git/merge.ts`) clones the bare, merges, and `git push origin main` —
a real push that fires the `post-receive` hook, which runs `.mind/workflow.yml`
(`npm install` + `vite build`) and publishes `dist/`. So `mergePull` alone is
enough. Verified 2026-05-30 in the live bridge log: a merge produced a
`post_receive ref=refs/heads/main` build. An earlier note claimed merge skipped
the hook and the orchestrator added a `triggerRun` (`POST .../runs`) after the
merge — that fired a **second** build and surfaced a **duplicate "site ready"
preview card**. `triggerRun` was removed; see `reconcile()` step 2 in
`orchestrator.ts`. (reconcile step 3 also now collapses all new terminal runs
into one card, as a guard against any double-build / overlapping polls.)

**Bridge runner needs network for `npm install`.** The Vite build fetches deps,
so the bridge's workflow runner must have network: run the bridge with
`MIND_RUNNER=native` (host network) or `MIND_WORKFLOW_NETWORK=bridge`. The
default Docker runner uses network `none` and the build will fail.

**Bridge needs pod-write credentials for the owner.** The dev `X-Mind-Dev-WebId`
header authorizes the bridge *API*, but the *publisher* needs a real
pod-writing `fetch` for the owner — either a delegated token (re-`/connect` the
owner on the bridge once) or seeded fallback (`ALLOW_SEEDED_FALLBACK=1` + matching
`POD_USER_*`). A stale delegated identity after a bridge restart yields
`OwnerFetchUnavailableError` and the bridge will NOT silently use seeded creds
(by design) — the fix is to re-`/connect`.

## Storage layout (pod, never a central DB)

Conversations use the SolidOS long-chat layout (reused from chat):
room = `{podRoot}builder/projects/{slug}/chat`, messages in
`chat/YYYY/MM/DD/chat.ttl`. Builder status / preview cards are also long-chat
messages with an extra `mind:messageKind` predicate. The authoritative project
record is `{podRoot}builder/projects/{slug}/project.ttl`. The sqlite cache
(`.builder-data/`) is a convenience mirror only — never the source of truth.

## Never log

Wish text, message bodies, push tokens, pod credentials, or full pod URLs with
query strings. OK to log: WebID, repo slug, route, status, latency, event type.

## Ports

Dev app `:3070`, own CSS `:3071`. The MVP points `NEXT_PUBLIC_POD_BASE_URL` and
`NEXT_PUBLIC_SOLID_ISSUER` at the **mind-codespaces bridge's CSS (:3011)** so the
WebID the builder signs in as matches the `owner` the bridge expects. Run the
bridge (`:3010` + its CSS `:3011`) before the builder.
