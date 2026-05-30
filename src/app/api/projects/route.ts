import { NextResponse } from "next/server";
import { listProjects } from "@/lib/builder/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List the signed-in user's projects (from the local cache). */
export async function GET(req: Request) {
  const webid = req.headers.get("x-mind-webid");
  if (!webid) {
    return NextResponse.json({ error: "missing x-mind-webid header" }, { status: 400 });
  }
  return NextResponse.json({ projects: listProjects(webid) });
}
