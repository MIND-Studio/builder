# builder

A lovable.dev-style **"wish an app"** chat builder on Solid. You chat a wish —
*"build me a landing page for my honey from my bees"* — a coding agent builds a
real Vite + React app, and a **live preview link** appears in the conversation.
Iterate by chatting again.

It is a thin **chat UI + server-side orchestrator** on top of the sibling
[`codespaces`](https://github.com/MIND-Studio/codespaces) bridge, which provides the entire
build engine (repos, the issue-driven coder agent, the build runner, and
Solid-Pod "Pages" publishing). The builder owns the conversation and project
model; the bridge owns repos and builds. See [`AGENTS.md`](./AGENTS.md).

## Shared packages (GitHub Packages)

This app installs `@mind-studio/core` and `@mind-studio/ui` from **GitHub Packages**.
A committed `.npmrc` scopes `@mind-studio` to that registry; before installing, export
a GitHub token with `read:packages`:

```bash
export NODE_AUTH_TOKEN=<a GitHub PAT with read:packages>
npm install
```

## Dev setup

This prototype needs the **mind-codespaces bridge running first** — it does the
building.

```bash
# 1. Start the shared Mind CSS (:3011), then the codespaces bridge.
(cd ../.. && docker compose up -d)         # shared Mind CSS on :3011 (see ../../SOLID-SERVER.md)
cd ../../codespaces
OPENROUTER_API_KEY=sk-or-...\
  MIND_AGENT_MODEL=openai/gpt-oss-120b:free \
  npm run dev                              # bridge on :3010

# 2. Start the builder (points at the shared :3011 so WebIDs line up).
cd ../apps/builder
cp .env.example .env.local                 # already targets :3010 / :3011
npm install
npm run dev                                # builder on :3070
```

Open <http://localhost:3070>, sign in as alice
(`alice@mind.local` / `dev-only-do-not-use-in-prod` on the shared CSS), and type
a wish.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server on `:3070` |
| `npm run seed:demo` | Create one demo "honey landing" project end-to-end against the local bridge (idempotent) |
| `npm run smoke:wish` | Drive `/api/wish`, poll until published, assert the preview URL returns 200 |
| `npm run typecheck` | `tsc --noEmit` |

## Ports

| Service | Port |
|---|---|
| Builder / Next.js | 3070 |
| mind-codespaces bridge (required) | 3010 |
| shared Mind CSS (required) | 3011 |

## Status

MVP (M1): single wish → React/Vite SPA → preview card in chat, against a local
bridge with dev-header auth. Iteration, multi-project dashboard, and the
production "delegated" bridge-session path are later milestones — see the plan
and `AGENTS.md`.

## Releases

Versioning, `CHANGELOG.md`, and tags are automated with
[release-please](https://github.com/googleapis/release-please) — **don't tag or
edit `CHANGELOG.md` by hand.**

1. Commit to `main` using [Conventional Commits](https://www.conventionalcommits.org):
   `fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` → major.
   `chore:` / `docs:` / `refactor:` / `test:` don't trigger a release.
2. release-please keeps an open **"chore(main): release X.Y.Z"** PR that rolls the
   pending commits into `CHANGELOG.md` and bumps the version.
3. Merge that PR to release: it creates the `vX.Y.Z` tag + GitHub Release, which
   fires `release.yml` to build and push the Docker image to GHCR.
4. Deploying the image to production is a separate, manual GitOps step in
   [`mindpods-infra`](https://github.com/MIND-Studio/mindpods-infra) (`mind-deploy.sh`).
