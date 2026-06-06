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
# 1. Start the codespaces bridge + its CSS, with a coder credential.
cd ../codespaces
docker compose up -d                       # CSS on :3011
OPENROUTER_API_KEY=sk-or-...\
  MIND_AGENT_MODEL=openai/gpt-oss-120b:free \
  npm run dev                              # bridge on :3010

# 2. Start the builder (points at the bridge's CSS so WebIDs line up).
cd ../builder
cp .env.example .env.local                 # already targets :3010 / :3011
npm install
npm run dev                                # builder on :3070
```

Open <http://localhost:3070>, sign in as alice
(`alice@mind-codespaces.local` / `dev-only-do-not-use-in-prod` on the bridge's
CSS), and type a wish.

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
| CommunitySolidServer (own, optional) | 3071 |
| mind-codespaces bridge (required) | 3010 |
| bridge CSS (required) | 3011 |

## Status

MVP (M1): single wish → React/Vite SPA → preview card in chat, against a local
bridge with dev-header auth. Iteration, multi-project dashboard, and the
production "delegated" bridge-session path are later milestones — see the plan
and `AGENTS.md`.
