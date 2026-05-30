/**
 * Validate the builder's POD DATA layer as alice, headless.
 *
 * The browser is what normally writes chat.ttl / project.ttl (client-side, with
 * the user's Inrupt pod session). The headless smoke:wish proves build+publish
 * but never opens a browser, so it never exercises those pod writes. This script
 * authenticates as alice against the bridge CSS (:3011) and drives the SAME
 * library functions the browser calls, then reads everything back and asserts
 * the long-chat layout + mind: predicates are correct.
 *
 *   tsx scripts/validate-pod.ts [slug]
 */
import { Session } from "@inrupt/solid-client-authn-node";
import { writeMessage, roomFor } from "@/lib/builder/conversation-client";
import { listTodayMessages, readRoomMeta } from "@/lib/solid/chat";
import { writeProjectRecord, readProjectRecord } from "@/lib/solid/projects-pod";
import { podRootFromWebId, previewUrlFor, projectTargetContainer } from "@/lib/solid/pod";

const POD_BASE = process.env.SOLID_OIDC_ISSUER ?? "http://localhost:3011/";
const ALICE = { email: "alice@mind-codespaces.local", password: "dev-only-do-not-use-in-prod" };
const WEBID = `${POD_BASE}alice/profile/card#me`;
const SLUG = process.argv.slice(2).join("").trim() || "build-me-a-landing-page-c4d74a";

type AuthedFetch = typeof fetch;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log(`[validate] pod   = ${POD_BASE}alice/`);
  console.log(`[validate] webid = ${WEBID}`);
  console.log(`[validate] slug  = ${SLUG}\n`);

  const f = await aliceFetch();
  const podRoot = podRootFromWebId(WEBID);
  const room = roomFor(WEBID, SLUG);
  const target = projectTargetContainer(podRoot, SLUG);

  // --- exercise the real pod-write path (mirrors build/page.tsx + orchestrator)
  console.log("[validate] writing conversation + project record via the real lib…");
  await writeMessage(f, WEBID, SLUG, { body: `build ${SLUG}`, kind: "user-wish", author: WEBID });
  await writeMessage(f, WEBID, SLUG, { body: "Your preview is live.", kind: "status" });
  await writeMessage(f, WEBID, SLUG, {
    body: "Preview ready",
    kind: "preview-card",
    previewUrl: previewUrlFor(target),
  });
  await writeProjectRecord(podRoot, {
    slug: SLUG,
    title: SLUG,
    repoOwner: "alice",
    repoName: SLUG,
    pagesUrl: previewUrlFor(target),
    targetContainer: target,
    lastIssue: 1,
    status: "published",
  }, f);

  // --- read it all back and validate structure -----------------------------
  console.log("\n[validate] room index (SolidOS long-chat):");
  const meta = await readRoomMeta(room, f);
  check("room index exists", !!meta);
  check("creator is alice", meta?.creator === WEBID, meta?.creator ?? "(none)");
  check("title === slug", meta?.title === SLUG, meta?.title ?? "(none)");

  console.log("\n[validate] chat.ttl messages:");
  const msgs = await listTodayMessages(room, f);
  check("3 messages present", msgs.length >= 3, `${msgs.length} found`);
  const wish = msgs.find((m) => m.kind === "user-wish");
  const status = msgs.find((m) => m.kind === "status");
  const preview = msgs.find((m) => m.kind === "preview-card");
  check("user-wish authored by alice", wish?.author === WEBID, wish?.author ?? "(none)");
  check("status message present", !!status, status?.body ?? "");
  check("preview-card carries previewUrl", !!preview?.previewUrl, preview?.previewUrl ?? "(none)");
  for (const m of msgs) console.log(`     · [${m.kind}] "${m.body}" — ${m.author.split("/").pop()}`);

  console.log("\n[validate] project.ttl record:");
  const proj = await readProjectRecord(podRoot, SLUG, f);
  check("project record exists", !!proj);
  check("slug matches", proj?.slug === SLUG, proj?.slug ?? "(none)");
  check("status === published", proj?.status === "published", proj?.status ?? "(none)");
  check("pagesUrl points into pod", !!proj && proj.pagesUrl.startsWith(POD_BASE), proj?.pagesUrl ?? "(none)");

  console.log(`\n[validate] ${failures === 0 ? "ALL POD DATA VALID" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

async function aliceFetch(): Promise<AuthedFetch> {
  const ctl = await controls();
  const loginUrl = ctl.controls.password?.login;
  if (!loginUrl) throw new Error("CSS missing password login endpoint");
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ALICE.email, password: ALICE.password }),
  });
  if (!loginRes.ok) throw new Error(`account login: ${loginRes.status}`);
  const { authorization } = (await loginRes.json()) as { authorization: string };

  const ctl2 = await controls(authorization);
  const credsUrl = ctl2.controls.account?.clientCredentials;
  if (!credsUrl) throw new Error("CSS missing clientCredentials endpoint");
  const credRes = await fetch(credsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `CSS-Account-Token ${authorization}` },
    body: JSON.stringify({ name: `builder-validate-${Date.now()}`, webId: WEBID }),
  });
  if (!credRes.ok) throw new Error(`client creds: ${credRes.status} ${await credRes.text()}`);
  const { id, secret } = (await credRes.json()) as { id: string; secret: string };

  const session = new Session();
  await session.login({ clientId: id, clientSecret: secret, oidcIssuer: POD_BASE, tokenType: "DPoP" });
  if (!session.info.isLoggedIn) throw new Error("session login failed");
  return session.fetch.bind(session) as AuthedFetch;
}

async function controls(authorization?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authorization) headers.Authorization = `CSS-Account-Token ${authorization}`;
  const res = await fetch(`${POD_BASE}.account/`, { headers });
  if (!res.ok) throw new Error(`CSS account API → ${res.status}. Is the bridge CSS up?`);
  return (await res.json()) as {
    controls: { password?: { login?: string }; account?: { clientCredentials?: string } };
  };
}

main().catch((err) => {
  console.error("[validate] failed:", err);
  process.exit(1);
});
