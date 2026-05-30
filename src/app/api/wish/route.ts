import { NextResponse } from "next/server";
import { createProject, iterateProject } from "@/lib/builder/orchestrator";
import { BridgeError } from "@/lib/builder/bridge-client";
import { log } from "@/lib/util/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Submit a wish. With no `slug` this creates a new project (repo + scaffold +
 * issue); with a `slug` it iterates the existing project (comments the issue).
 *
 * Identity: the browser sends its WebID in `x-mind-webid`. In dev that's
 * trusted and forwarded to the bridge as `X-Mind-Dev-WebId`. Verifying the
 * browser actually controls the WebID is a hardening item (see AGENTS.md).
 */
export async function POST(req: Request) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }

  let body: { text?: string; slug?: string };
  try {
    body = (await req.json()) as { text?: string; slug?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty wish" }, { status: 400 });

  try {
    const result = body.slug
      ? await iterateProject(webid, body.slug, text)
      : await createProject(webid, text);
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof BridgeError ? e.status : 500;
    log.error({ event: "builder.wish.failed", err: String(e) }, "wish failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "wish failed" },
      { status },
    );
  }
}
