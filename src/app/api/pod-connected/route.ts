import { NextResponse } from "next/server";
import { getConnection } from "@/lib/builder/bridge-client";
import { bridgeUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Has the signed-in user authorized the bridge to write to their pod?
 * The builder uses this to gate the first wish behind a one-time `/connect`
 * step (the publisher can't ship a site without a delegated pod token).
 * Also returns the bridge's connect URL so the client can link to it.
 */
export async function GET(req: Request) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  try {
    const { connected } = await getConnection(webid);
    return NextResponse.json({ connected, connectUrl: `${bridgeUrl}/connect` });
  } catch {
    // If the check itself fails, don't hard-block — assume connected and let
    // the build-time reconcile surface any real auth error.
    return NextResponse.json({ connected: true, connectUrl: `${bridgeUrl}/connect` });
  }
}
