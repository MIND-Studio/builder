-- Local convenience cache of project / build status. NON-AUTHORITATIVE:
-- the pod project.ttl is the source of truth. This just lets the UI render
-- the last-known status fast and lets the poller reconcile against the bridge.

CREATE TABLE IF NOT EXISTS projects (
  slug             TEXT PRIMARY KEY,
  web_id           TEXT NOT NULL,
  repo_owner       TEXT NOT NULL,
  repo_name        TEXT NOT NULL,
  pages_url        TEXT NOT NULL,
  target_container TEXT NOT NULL,
  last_issue       INTEGER,
  status           TEXT NOT NULL,
  status_detail    TEXT NOT NULL DEFAULT '',
  updated_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_webid ON projects (web_id);

-- Tracks which bridge agent-run / pull each project last observed, so the
-- poller can detect *new* activity and avoid posting duplicate chat status.
CREATE TABLE IF NOT EXISTS project_progress (
  slug              TEXT PRIMARY KEY REFERENCES projects (slug) ON DELETE CASCADE,
  last_run_id       INTEGER,
  last_comment_id   INTEGER,
  last_pull_number  INTEGER,
  last_pull_merged  INTEGER NOT NULL DEFAULT 0,
  last_published    INTEGER NOT NULL DEFAULT 0,
  last_agent_run_id INTEGER NOT NULL DEFAULT 0
);
