/**
 * Turn a free-text wish into a coder-friendly issue. The issue body is the
 * prompt the opencode coder reads, so it spells out the (already-pushed)
 * project shape and the constraints that keep the build publishable.
 */
export function buildIssueBody(wish: string, isFollowUp = false): string {
  if (isFollowUp) {
    return `${wish.trim()}

(Keep this a Vite + React + Tailwind v4 app that builds with \`vite build\` to \`dist/\`. Edit the existing files under \`src/\`. Don't add a server or change the build/publish setup.)`;
  }
  return `Build this: ${wish.trim()}

This repository is already a working **Vite + React 19 + Tailwind CSS v4** single-page app:
- Entry: \`src/main.tsx\` → \`src/App.tsx\`. Tailwind is imported in \`src/index.css\`.
- It builds with \`npm install && vite build\` to \`dist/\`, which the platform publishes as a static site.

Please implement the request by editing the React components and styles:
- Put the main content in \`src/App.tsx\` (split into components under \`src/\` if helpful).
- Use Tailwind utility classes for styling; make it look polished and on-theme.
- Keep it a static front-end only — no backend, no server, no env vars, no new build tooling. It is published as a static site (Vite \`base: './'\` → \`dist/\`); never add SSR, API routes, or anything needing a server at runtime.
- This is React 19 with the AUTOMATIC JSX runtime. Import hooks by name and call
  them directly: \`import { useState, useEffect, useRef } from "react"\` then
  \`useState(...)\`. Do NOT write \`React.useState\` / \`React.useEffect\` and do NOT
  assume a global \`React\` exists — that throws "React is not defined" at runtime
  and ships a blank page. (You don't need to import React just to use JSX.)
- DARK MODE: this app uses Tailwind v4 **class-based** dark mode. \`src/index.css\`
  already declares \`@custom-variant dark (&:where(.dark, .dark *));\`, so \`dark:\`
  utilities activate when a \`.dark\` class is on an ancestor. To add a dark-mode
  toggle, keep a boolean in state and put \`.dark\` on a root wrapper, e.g.
  \`<div className={isDark ? "dark" : ""}>…</div>\`, then style with \`dark:\`
  variants (\`bg-white dark:bg-stone-900\`). If \`src/index.css\` lacks that
  \`@custom-variant dark\` line, add it — without it the \`dark:\` classes only
  follow the OS theme and the toggle appears to do nothing.

IMPORTANT — do NOT change the build setup, or the platform can't publish the site:
- Do NOT run the build yourself and do NOT commit a \`dist/\` folder or \`node_modules/\`. The platform runs \`npm install && vite build\` and publishes \`dist/\` for you.
- Do NOT delete, move, or edit \`.mind/workflow.yml\`, \`vite.config.ts\`, \`index.html\`, \`package.json\`'s scripts, or \`src/main.tsx\`.
- Only edit/add files under \`src/\` (mainly \`src/App.tsx\` and styles).`;
}

/** A short, human title for the issue + project. */
export function buildIssueTitle(wish: string): string {
  const clean = wish.trim().replace(/\s+/g, " ");
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

/** A display title (used in the scaffold's <title> + project record). */
export function buildAppTitle(wish: string): string {
  return buildIssueTitle(wish);
}
