import "server-only";
import { bridgeUrl } from "@/lib/env";
import { bridgeAuthHeaders } from "./bridge-auth";

/**
 * Typed thin wrappers over the mind-codespaces bridge REST API. Every mutating
 * call carries the dev auth header for `webId`; read GETs are public on the
 * bridge (no auth needed) but we send the header anyway for consistency.
 *
 * Response shapes mirror the bridge's route handlers + registry types
 * (src/lib/registry/{repos,issues,pulls,agent-runs}.ts).
 */

export type BridgeRepo = {
  owner: string;
  name: string;
  defaultBranch: string;
  visibility: "public" | "private";
};

export type BridgeIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  status: "open" | "closed";
  priority: "low" | "normal" | "high";
};

export type BridgeComment = {
  id: number;
  body: string;
  authorWebId: string;
  agentRunId: number | null;
  createdAt: number;
};

export type BridgePull = {
  id: number;
  number: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  status: "open" | "merged" | "closed";
  issueId: number | null;
  agentRunId: number | null;
};

export type BridgeAgentRun = {
  id: number;
  issueId: number | null;
  role: string;
  driver: string;
  status: "running" | "ok" | "error";
  summary: string;
  errorMessage: string | null;
};

export type BridgePages = {
  enabled: boolean;
  sourceBranch: string;
  sourcePath: string;
  targetContainer: string;
};

export type BridgeWorkflowRun = {
  id: number;
  status: string;
  exitCode: number | null;
  errorMessage: string | null;
};

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

async function call<T>(
  webId: string | null,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webId && init?.method && init.method !== "GET") {
    Object.assign(headers, bridgeAuthHeaders(webId));
  } else if (webId) {
    Object.assign(headers, bridgeAuthHeaders(webId));
  }
  const res = await fetch(`${bridgeUrl}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    // server-to-server: no Origin header, so the bridge's CORS allowlist
    // is bypassed entirely.
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    throw new BridgeError(
      (data.error as string) ?? `bridge ${res.status}`,
      res.status,
      data.code as string | undefined,
    );
  }
  return data as T;
}

export async function createRepo(
  webId: string,
  args: {
    owner: string;
    name: string;
    ownerWebId: string;
    ownerPodRoot: string;
    visibility: "public" | "private";
  },
): Promise<{ repo: BridgeRepo; cloneUrl: string }> {
  return call(webId, "/api/repos", { method: "POST", body: args });
}

export async function getRepo(owner: string, name: string): Promise<{ repo: BridgeRepo } | null> {
  try {
    return await call(null, `/api/repos/${owner}/${name}`);
  } catch (e) {
    if (e instanceof BridgeError && e.status === 404) return null;
    throw e;
  }
}

export async function enablePages(
  webId: string,
  owner: string,
  name: string,
  args: { sourceBranch: string; sourcePath: string; targetContainer: string },
): Promise<{ pages: BridgePages }> {
  return call(webId, `/api/repos/${owner}/${name}/pages`, {
    method: "PUT",
    body: { enabled: true, ...args },
  });
}

export async function getPages(owner: string, name: string): Promise<{ pages: BridgePages }> {
  return call(null, `/api/repos/${owner}/${name}/pages`);
}

export async function mintToken(
  webId: string,
  owner: string,
  name: string,
  label: string,
): Promise<{ token: string; id: number }> {
  return call(webId, `/api/repos/${owner}/${name}/tokens`, {
    method: "POST",
    body: { label },
  });
}

export async function createIssue(
  webId: string,
  owner: string,
  name: string,
  args: { title: string; body: string; priority?: "low" | "normal" | "high" },
): Promise<{ issue: BridgeIssue }> {
  return call(webId, `/api/repos/${owner}/${name}/issues`, {
    method: "POST",
    body: args,
  });
}

export async function getIssue(
  owner: string,
  name: string,
  number: number,
): Promise<{ issue: BridgeIssue; comments: BridgeComment[] }> {
  return call(null, `/api/repos/${owner}/${name}/issues/${number}`);
}

export async function addComment(
  webId: string,
  owner: string,
  name: string,
  number: number,
  body: string,
): Promise<{ comment: BridgeComment }> {
  return call(webId, `/api/repos/${owner}/${name}/issues/${number}/comments`, {
    method: "POST",
    body: { body },
  });
}

export async function listPulls(
  owner: string,
  name: string,
  status: "open" | "merged" | "closed" | "all" = "all",
): Promise<{ pulls: BridgePull[] }> {
  return call(null, `/api/repos/${owner}/${name}/pulls?status=${status}`);
}

export async function mergePull(
  webId: string,
  owner: string,
  name: string,
  number: number,
): Promise<{ pull: BridgePull; closedIssueNumber: number | null }> {
  return call(webId, `/api/repos/${owner}/${name}/pulls/${number}/merge`, {
    method: "POST",
  });
}

export async function getAgentRun(id: number): Promise<{ run: BridgeAgentRun }> {
  return call(null, `/api/agent-runs/${id}`);
}

/** Recent coder runs for an issue — lets us see error/timeout runs that opened
 *  no PR or comment (so the UI doesn't hang on "working…"). */
export async function listIssueAgentRuns(
  owner: string,
  name: string,
  number: number,
): Promise<{ runs: BridgeAgentRun[] }> {
  return call(null, `/api/repos/${owner}/${name}/issues/${number}/agent-runs`);
}

/**
 * Trigger a workflow build+publish on the default branch. Needed after a
 * server-side PR merge: merging updates the `main` ref directly (it does NOT
 * fire the push hook), so the bridge would only do a "legacy" source publish.
 * This runs `.mind/workflow.yml` (npm install + vite build) and publishes
 * `dist/` — turning the merged source into the actual built site.
 */
export async function triggerRun(
  webId: string,
  owner: string,
  name: string,
): Promise<{ runId: number | null }> {
  return call(webId, `/api/repos/${owner}/${name}/runs`, { method: "POST", body: {} });
}

export async function listRuns(
  owner: string,
  name: string,
): Promise<{ runs: BridgeWorkflowRun[] }> {
  return call(null, `/api/repos/${owner}/${name}/runs`);
}

// ---------------------------------------------------------------------------
// Bring-your-own-key AI settings (the bridge owns the encrypted key vault;
// we only proxy. Plaintext keys flow request→bridge once and are never
// returned, stored, or logged here.)
// ---------------------------------------------------------------------------

export type AiProviderName = "openrouter" | "google" | "anthropic" | "openai";

export type AiModelOption = { id: string; label: string; note?: string };

export type AiCatalogEntry = {
  name: AiProviderName;
  label: string;
  blurb: string;
  keysUrl: string;
  keyShapeHint: string;
  models: AiModelOption[];
};

export type AiConfiguredProvider = {
  provider: AiProviderName;
  /** Last 4 chars of the stored key — all the bridge ever reveals. */
  hint: string;
  createdAt: number;
  updatedAt: number;
};

export type AiPref = {
  provider: AiProviderName | null;
  model: string | null;
  updatedAt: number | null;
};

export type AiSummary =
  | { source: "user-pref"; provider: AiProviderName; providerLabel: string; model: string }
  | { source: "env-fallback"; provider: "openrouter"; providerLabel: string; model: string }
  | { source: "none" };

export type AiSettings = {
  providers: AiConfiguredProvider[];
  pref: AiPref;
  summary: AiSummary;
  /**
   * Remaining free MIND allotment, when the coder would run on the bridge's
   * built-in key and the ledger is on. null when on the user's own key or the
   * ledger is off — render the source-based copy unchanged.
   */
  freeBalance?: number | null;
  catalog: AiCatalogEntry[];
};

export async function getAiSettings(webId: string): Promise<AiSettings> {
  return call(webId, "/api/profile/ai");
}

export async function setAiKey(
  webId: string,
  provider: string,
  apiKey: string,
): Promise<{ provider: AiConfiguredProvider }> {
  return call(webId, `/api/profile/ai/keys/${provider}`, {
    method: "POST",
    body: { apiKey },
  });
}

export async function deleteAiKey(webId: string, provider: string): Promise<{ ok: boolean }> {
  return call(webId, `/api/profile/ai/keys/${provider}`, { method: "DELETE" });
}

export async function setAiPref(
  webId: string,
  provider: AiProviderName | null,
  model: string | null,
): Promise<{ pref: AiPref }> {
  return call(webId, "/api/profile/ai/pref", {
    method: "PUT",
    body: { provider, model },
  });
}

/** Whether the bridge holds a delegated pod-write grant for this WebID. */
export async function getConnection(webId: string): Promise<{ connected: boolean }> {
  return call(null, `/api/identities/${encodeURIComponent(webId)}`);
}

/** HEAD the published index to detect when Pages has actually gone live. */
export async function isPublished(targetContainer: string): Promise<boolean> {
  const url = targetContainer.endsWith("/")
    ? `${targetContainer}index.html`
    : `${targetContainer}/index.html`;
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
