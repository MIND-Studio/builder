/**
 * Seed one demo project ("honey landing") end-to-end against a running builder
 * + bridge, so the dashboard has something to show. Idempotent: if a project
 * whose slug starts with "build-me-a-landing" already exists, it's reused.
 *
 * Requires the builder dev server (:3070) and the codespaces bridge (:3010 +
 * CSS :3011 with a coder key) running. Drives the builder HTTP API.
 *
 *   npm run seed:demo
 */
export {};

const BUILDER = (process.env.BUILDER_URL ?? "http://localhost:3070").replace(/\/$/, "");
const WEBID =
  process.env.SEED_WEBID ?? "http://localhost:3011/alice/profile/card#me";
const WISH = "build me a landing page for my honey from my bees";

type Project = { slug: string; status: string; statusDetail: string; pagesUrl: string };

async function main() {
  console.log(`[seed] builder=${BUILDER}`);

  const { projects } = await get<{ projects: Project[] }>("/api/projects");
  const existing = projects.find((p) => p.slug.startsWith("build-me-a-landing"));
  let slug: string;
  let pagesUrl: string;
  if (existing) {
    console.log(`[seed] reusing existing project ${existing.slug}`);
    slug = existing.slug;
    pagesUrl = existing.pagesUrl;
  } else {
    const created = await post<{ project: Project }>("/api/wish", { text: WISH });
    slug = created.project.slug;
    pagesUrl = created.project.pagesUrl;
    console.log(`[seed] created ${slug}`);
  }

  // Nudge the build along a few times so the agent's PR gets merged + published.
  for (let i = 0; i < 6; i++) {
    const { project } = await post<{ project: Project }>(`/api/projects/${slug}/status`, undefined);
    console.log(`[seed] ${project.status} — ${project.statusDetail}`);
    if (project.status === "published" || project.status === "awaiting-user") break;
    await sleep(4_000);
  }

  console.log(`[seed] done. open ${BUILDER}/build/${slug}`);
  console.log(`[seed] preview (once built): ${pagesUrl}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BUILDER}${path}`, { headers: { "x-mind-webid": WEBID } });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  return JSON.parse(text) as T;
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
