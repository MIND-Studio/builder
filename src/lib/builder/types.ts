/**
 * Shared types for the wish → build → preview loop. Safe to import from both
 * server and client (no runtime dependencies).
 */

/** State machine for a project's current build. */
export type ProjectStatus =
  | "creating-repo"
  | "scaffolding"
  | "issue-created"
  | "coder-running"
  | "awaiting-user" // coder asked a clarifying question
  | "merging"
  | "building"
  | "published"
  | "error";

export type Project = {
  /** Repo-safe slug; unique per owner. Also the project route segment. */
  slug: string;
  /** Owner WebID this project belongs to. */
  webId: string;
  /** Bridge repo coordinates. */
  repoOwner: string;
  repoName: string;
  /** Pod URL where the published site lives (targetContainer + index.html). */
  pagesUrl: string;
  /** Pages targetContainer (ends with a slash). */
  targetContainer: string;
  /** The single issue thread that drives this project's conversation. */
  lastIssue: number | null;
  status: ProjectStatus;
  /** Human-readable one-liner of the current step (for chat status). */
  statusDetail: string;
  updatedAt: number;
};

/** Message kinds carried in the pod chat via the `mind:messageKind` predicate. */
export type MessageKind = "user-wish" | "status" | "agent-question" | "preview-card";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  "creating-repo": "Creating your project…",
  scaffolding: "Setting up your React app…",
  "issue-created": "Starting on your wish…",
  "coder-running": "Writing your code…",
  "awaiting-user": "I have a question for you.",
  merging: "Adding the new changes…",
  building: "Building & publishing your app…",
  published: "Your preview is live.",
  error: "Something went wrong.",
};
