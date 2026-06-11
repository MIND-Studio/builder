import { NextResponse } from "next/server";
import { BridgeError, getAiSettings } from "@/lib/builder/bridge-client";
import { log } from "@/lib/util/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Snapshot of the signed-in user's AI setup (stored-key hints, selected
 *  model, what builds use right now, provider catalog). Proxied from the
 *  bridge — keys themselves never appear in any response. */
export async function GET(req: Request) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getAiSettings(webid));
  } catch (e) {
    const status = e instanceof BridgeError ? e.status : 500;
    log.error({ event: "builder.ai.settings.failed", status }, "ai settings fetch failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load AI settings" },
      { status },
    );
  }
}
