/**
 * Derive a repo-safe slug from free-text wish. Keeps lowercase alphanumerics
 * and hyphens, collapses runs, trims to a sane length, and falls back to
 * "app" when the wish has no usable characters. The orchestrator appends a
 * disambiguating suffix on collision (the bridge 409s on duplicate names).
 */
export function slugifyWish(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .split("-")
    .filter(Boolean)
    .slice(0, 5)
    .join("-");
  const trimmed = base.slice(0, 40).replace(/-+$/g, "");
  return trimmed || "app";
}

/**
 * Turn a repo slug back into a friendly display title, e.g.
 * `build-me-a-pomodoro-timer` → `Pomodoro Timer`. Strips a leading filler
 * phrase ("build me a", "make a", …) and title-cases the rest.
 */
export function humanizeSlug(slug: string): string {
  const STOP = new Set([
    "build", "me", "a", "an", "the", "create", "make", "my", "please", "app", "some",
  ]);
  let words = slug.split("-").filter(Boolean);
  while (words.length > 1 && STOP.has(words[0] ?? "")) words = words.slice(1);
  if (words.length === 0) words = slug.split("-").filter(Boolean);
  const title = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return title || slug;
}

/** Short random suffix for slug disambiguation (no Date/Math.random reliance). */
export function shortSuffix(): string {
  const rand = crypto.getRandomValues(new Uint8Array(3));
  return Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
}
