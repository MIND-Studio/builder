import { NextResponse } from "next/server";
import { BridgeError, setAiKey, deleteAiKey } from "@/lib/builder/bridge-client";
import { log } from "@/lib/util/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

/** Save the user's own API key for a provider. The key is forwarded to the
 *  bridge's encrypted vault and never stored or logged here. */
export async function POST(req: Request, { params }: Params) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  const { provider } = await params;

  let body: { apiKey?: string };
  try {
    body = (await req.json()) as { apiKey?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.apiKey !== "string" || !body.apiKey.trim()) {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  try {
    const saved = await setAiKey(webid, provider, body.apiKey.trim());
    log.info({ event: "builder.ai.key.saved", provider }, "ai key saved");
    return NextResponse.json(saved);
  } catch (e) {
    const status = e instanceof BridgeError ? e.status : 500;
    log.error({ event: "builder.ai.key.save_failed", provider, status }, "ai key save failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to save key" },
      { status },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  const { provider } = await params;
  try {
    await deleteAiKey(webid, provider);
    log.info({ event: "builder.ai.key.deleted", provider }, "ai key deleted");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof BridgeError ? e.status : 500;
    log.error({ event: "builder.ai.key.delete_failed", provider, status }, "ai key delete failed");
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to remove key" },
      { status },
    );
  }
}
