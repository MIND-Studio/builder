/**
 * Walk alice's pod and dump the builder-related contents as they exist now.
 *   tsx scripts/dump-pod.ts
 */
import { Session } from "@inrupt/solid-client-authn-node";
import { getSolidDataset, getContainedResourceUrlAll } from "@inrupt/solid-client";

const POD_BASE = process.env.SOLID_OIDC_ISSUER ?? "http://localhost:3011/";
const ALICE = { email: "alice@mind-codespaces.local", password: "dev-only-do-not-use-in-prod" };
const WEBID = `${POD_BASE}alice/profile/card#me`;
const ROOT = `${POD_BASE}alice/`;

type AuthedFetch = typeof fetch;

async function main() {
  const f = await aliceFetch();

  for (const start of [`${ROOT}builder/`, `${ROOT}public/sites/`]) {
    console.log(`\n${"=".repeat(70)}\n# ${start}\n${"=".repeat(70)}`);
    await walk(f, start, 0);
  }
}

const CONTAINER = "http://www.w3.org/ns/ldp#Container";

async function walk(f: AuthedFetch, url: string, depth: number) {
  const pad = "  ".repeat(depth);
  const children = await contains(f, url);
  if (children === null) {
    console.log(`${pad}(unreadable / missing)`);
    return;
  }
  for (const c of children) {
    const name = c.replace(url, "");
    if (c.endsWith("/")) {
      console.log(`${pad}${name}`);
      await walk(f, c, depth + 1);
    } else {
      const isText = /\.(ttl|html|json|css|txt|md)$/.test(c);
      const size = await sizeOf(f, c);
      console.log(`${pad}${name}   (${size})`);
      if (c.endsWith(".ttl")) {
        const body = await readText(f, c);
        console.log(body.split("\n").map((l) => `${pad}  | ${l}`).join("\n"));
      } else if (!isText) {
        // binary/asset — listing + size is enough
      }
    }
  }
}

async function contains(f: AuthedFetch, url: string): Promise<string[] | null> {
  try {
    const ds = await getSolidDataset(url, { fetch: f });
    return getContainedResourceUrlAll(ds).sort();
  } catch {
    return null;
  }
}

async function sizeOf(f: AuthedFetch, url: string): Promise<string> {
  const res = await f(url, { method: "HEAD" });
  const n = Number(res.headers.get("content-length") ?? 0);
  return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

async function readText(f: AuthedFetch, url: string): Promise<string> {
  const res = await f(url, { headers: { Accept: "text/turtle" } });
  return res.ok ? (await res.text()).trim() : `(read failed ${res.status})`;
}

async function aliceFetch(): Promise<AuthedFetch> {
  const ctl = await controls();
  const loginRes = await fetch(ctl.controls.password!.login!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ALICE.email, password: ALICE.password }),
  });
  if (!loginRes.ok) throw new Error(`account login: ${loginRes.status}`);
  const { authorization } = (await loginRes.json()) as { authorization: string };
  const ctl2 = await controls(authorization);
  const credRes = await fetch(ctl2.controls.account!.clientCredentials!, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `CSS-Account-Token ${authorization}` },
    body: JSON.stringify({ name: `dump-${Date.now()}`, webId: WEBID }),
  });
  if (!credRes.ok) throw new Error(`client creds: ${credRes.status}`);
  const { id, secret } = (await credRes.json()) as { id: string; secret: string };
  const session = new Session();
  await session.login({ clientId: id, clientSecret: secret, oidcIssuer: POD_BASE, tokenType: "DPoP" });
  return session.fetch.bind(session) as AuthedFetch;
}

async function controls(authorization?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authorization) headers.Authorization = `CSS-Account-Token ${authorization}`;
  const res = await fetch(`${POD_BASE}.account/`, { headers });
  if (!res.ok) throw new Error(`CSS account API → ${res.status}`);
  return (await res.json()) as {
    controls: { password?: { login?: string }; account?: { clientCredentials?: string } };
  };
}

main().catch((e) => {
  console.error("[dump] failed:", e);
  process.exit(1);
});
