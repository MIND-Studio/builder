/**
 * End-to-end smoke test for the wish → build → preview loop.
 *
 * Requires both servers running:
 *   - mind-codespaces bridge on :3010 (+ its CSS on :3011, with a coder key)
 *   - mind-builder dev server on :3070
 *
 * Drives the builder's own HTTP API exactly as the browser does (minus the pod
 * chat writes), then asserts the published preview URL returns 200.
 *
 *   npm run smoke:wish               # default honey wish
 *   npm run smoke:wish -- "build me a portfolio site"
 */
export {};

const BUILDER = (process.env.BUILDER_URL ?? "http://localhost:3070").replace(/\/$/, "");
const WEBID =
  process.env.SEED_WEBID ?? "http://localhost:3011/alice/profile/card#me";
const WISH =
  process.argv.slice(2).join(" ").trim() ||
  "build me a landing page for my honey from my bees";

const POLL_MS = 5_000;
const MAX_POLLS = 180; // ~15 minutes — Vite builds on the free tier are slow

type Project = { slug: string; status: string; statusDetail: string; pagesUrl: string };

async function main() {
  console.log(`[smoke] builder=${BUILDER}`);
  console.log(`[smoke] wish="${WISH}"`);

  const created = await post<{ project: Project }>("/api/wish", { text: WISH });
  const slug = created.project.slug;
  console.log(`[smoke] project=${slug} → ${created.project.pagesUrl}`);

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);
    const { project } = await post<{ project: Project }>(`/api/projects/${slug}/status`, undefined);
    console.log(`[smoke] [${i}] ${project.status} — ${project.statusDetail}`);
    if (project.status === "published") {
      const ok = await head(project.pagesUrl);
      if (ok) {
        console.log(`[smoke] PASS — preview live at ${project.pagesUrl}`);
        process.exit(0);
      }
      console.log(`[smoke] status=published but ${project.pagesUrl} not 200 yet; continuing`);
    }
    if (project.status === "error") {
      console.error(`[smoke] FAIL — build errored. Check the bridge logs + AI provider key.`);
      process.exit(1);
    }
  }
  console.error(`[smoke] FAIL — timed out after ${(MAX_POLLS * POLL_MS) / 1000}s`);
  process.exit(1);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BUILDER}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mind-webid": WEBID },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function head(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("[smoke] failed:", err);
  process.exit(1);
});
