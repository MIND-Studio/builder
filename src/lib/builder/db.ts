import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { indexerDataDir } from "@/lib/env";
import type { Project, ProjectStatus } from "./types";

// better-sqlite3 singleton, cached on globalThis so Next.js dev hot-reloads
// don't open a new handle per request (pattern from
// mind-social-network-v0/src/lib/indexer/db.ts).
const GLOBAL_KEY = "__builder_db__";
declare global {
  // eslint-disable-next-line no-var
  var __builder_db__: Database.Database | undefined;
}

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");

function openAt(dir: string): Database.Database {
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, "builder.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(SCHEMA_PATH, "utf-8"));
  // Tiny forward-migration for the non-authoritative cache: add columns that
  // postdate an existing builder.db (CREATE TABLE IF NOT EXISTS won't add them).
  try {
    db.exec(
      "ALTER TABLE project_progress ADD COLUMN last_agent_run_id INTEGER NOT NULL DEFAULT 0",
    );
  } catch {
    // column already exists — fine
  }
  return db;
}

export function getDb(): Database.Database {
  const cached = globalThis[GLOBAL_KEY];
  if (cached) return cached;

  let db: Database.Database;
  try {
    db = openAt(indexerDataDir);
  } catch (err) {
    // This sqlite file is a non-authoritative convenience cache (the pod is the
    // source of truth). In a read-only/non-writable CWD (e.g. the prod
    // container's root-owned WORKDIR run as an unprivileged user) the configured
    // dir can't be created — don't 500 the whole app over a cache. Fall back to
    // a guaranteed-writable temp dir.
    const fallback = join(tmpdir(), "builder-data");
    const e = err as NodeJS.ErrnoException;
    console.warn(
      `[builder/db] cannot use INDEXER_DATA_DIR (${indexerDataDir}): ${
        e.code ?? e.message
      } — falling back to ${fallback}`,
    );
    db = openAt(fallback);
  }
  globalThis[GLOBAL_KEY] = db;
  return db;
}

type ProjectRow = {
  slug: string;
  web_id: string;
  repo_owner: string;
  repo_name: string;
  pages_url: string;
  target_container: string;
  last_issue: number | null;
  status: string;
  status_detail: string;
  updated_at: number;
};

function toProject(row: ProjectRow): Project {
  return {
    slug: row.slug,
    webId: row.web_id,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    pagesUrl: row.pages_url,
    targetContainer: row.target_container,
    lastIssue: row.last_issue,
    status: row.status as ProjectStatus,
    statusDetail: row.status_detail,
    updatedAt: row.updated_at,
  };
}

export function getProject(slug: string): Project | null {
  const row = getDb()
    .prepare("SELECT * FROM projects WHERE slug = ?")
    .get(slug) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function listProjects(webId: string): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects WHERE web_id = ? ORDER BY updated_at DESC")
    .all(webId) as ProjectRow[];
  return rows.map(toProject);
}

export function slugExists(slug: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug);
}

export function upsertProject(p: Project): void {
  getDb()
    .prepare(
      `INSERT INTO projects
         (slug, web_id, repo_owner, repo_name, pages_url, target_container,
          last_issue, status, status_detail, updated_at)
       VALUES (@slug, @webId, @repoOwner, @repoName, @pagesUrl, @targetContainer,
          @lastIssue, @status, @statusDetail, @updatedAt)
       ON CONFLICT(slug) DO UPDATE SET
         pages_url = excluded.pages_url,
         target_container = excluded.target_container,
         last_issue = excluded.last_issue,
         status = excluded.status,
         status_detail = excluded.status_detail,
         updated_at = excluded.updated_at`,
    )
    .run(p);
}

export function setStatus(
  slug: string,
  status: ProjectStatus,
  statusDetail: string,
  updatedAt: number,
): void {
  getDb()
    .prepare(
      "UPDATE projects SET status = ?, status_detail = ?, updated_at = ? WHERE slug = ?",
    )
    .run(status, statusDetail, updatedAt, slug);
}

// ---- progress (poller bookkeeping) ----------------------------------------

export type Progress = {
  slug: string;
  lastRunId: number | null;
  lastCommentId: number | null;
  lastPullNumber: number | null;
  lastPullMerged: boolean;
  lastPublished: boolean;
  lastAgentRunId: number;
};

type ProgressRow = {
  slug: string;
  last_run_id: number | null;
  last_comment_id: number | null;
  last_pull_number: number | null;
  last_pull_merged: number;
  last_published: number;
  last_agent_run_id: number;
};

export function getProgress(slug: string): Progress {
  const row = getDb()
    .prepare("SELECT * FROM project_progress WHERE slug = ?")
    .get(slug) as ProgressRow | undefined;
  if (!row) {
    return {
      slug,
      lastRunId: null,
      lastCommentId: null,
      lastPullNumber: null,
      lastPullMerged: false,
      lastPublished: false,
      lastAgentRunId: 0,
    };
  }
  return {
    slug: row.slug,
    lastRunId: row.last_run_id,
    lastCommentId: row.last_comment_id,
    lastPullNumber: row.last_pull_number,
    lastPullMerged: row.last_pull_merged === 1,
    lastPublished: row.last_published === 1,
    lastAgentRunId: row.last_agent_run_id ?? 0,
  };
}

export function setProgress(p: Progress): void {
  getDb()
    .prepare(
      `INSERT INTO project_progress
         (slug, last_run_id, last_comment_id, last_pull_number, last_pull_merged, last_published, last_agent_run_id)
       VALUES (@slug, @lastRunId, @lastCommentId, @lastPullNumber, @lastPullMerged, @lastPublished, @lastAgentRunId)
       ON CONFLICT(slug) DO UPDATE SET
         last_run_id = excluded.last_run_id,
         last_comment_id = excluded.last_comment_id,
         last_pull_number = excluded.last_pull_number,
         last_pull_merged = excluded.last_pull_merged,
         last_published = excluded.last_published,
         last_agent_run_id = excluded.last_agent_run_id`,
    )
    .run({
      slug: p.slug,
      lastRunId: p.lastRunId,
      lastCommentId: p.lastCommentId,
      lastPullNumber: p.lastPullNumber,
      lastPullMerged: p.lastPullMerged ? 1 : 0,
      lastPublished: p.lastPublished ? 1 : 0,
      lastAgentRunId: p.lastAgentRunId,
    });
}
