import { NextResponse } from "next/server";
import { type AiProviderName, BridgeError, setAiPref } from "@/lib/builder/bridge-client";
import { log } from "@/lib/util/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Select which provider+model the user's builds run with. `{provider: null,
 *  model: null}` switches back to the built-in free setup. */
export async function PUT(req: Request) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }

  let body: { provider?: AiProviderName | null; model?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const saved = await setAiPref(webid, body.provider ?? null, body.model ?? null);
    log.info({ event: "builder.ai.pref.saved", provider: body.provider ?? null }, "ai pref saved");
    return NextResponse.json(saved);
  } catch (e) {
    const status = e instanceof BridgeError ? e.status : 500;
    log.error({ event: "builder.ai.pref.save_failed", status }, "ai pref save failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to save choice" },
      { status },
    );
  }
}
