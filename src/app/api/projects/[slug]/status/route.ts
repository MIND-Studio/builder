import { NextResponse } from "next/server";
import { reconcile } from "@/lib/builder/orchestrator";
import { log } from "@/lib/util/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * Reconcile a project against the bridge and advance its state machine.
 * POST (not GET) because it has side effects — it merges ready PRs to trigger
 * publishing. Returns the latest project status plus newly-observed events the
 * browser should persist into the pod conversation.
 */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  try {
    const { project, events } = await reconcile(webid, slug);
    return NextResponse.json({ project, events });
  } catch (e) {
    log.warn({ event: "builder.status.failed", slug, err: String(e) }, "reconcile failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "reconcile failed" },
      { status: 404 },
    );
  }
}
