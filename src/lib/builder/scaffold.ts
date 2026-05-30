import "server-only";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bridgeUrl } from "@/lib/env";

/**
 * A minimal-but-complete Vite + React + Tailwind v4 starter. We push this to
 * `main` BEFORE filing the wish issue so the coder only edits app content
 * (src/App.tsx, copy, colors) rather than bootstrapping tooling — which keeps
 * coder turns small and reliable on free models.
 *
 * The build is `vite build` → `dist/`, published by the bridge's Pages runner
 * via `.mind/workflow.yml`. `npm install` (not `ci`) avoids needing a checked-in
 * lockfile; the bridge must run the workflow with network access (native runner
 * or MIND_WORKFLOW_NETWORK=bridge) so deps can be fetched.
 */
function scaffoldFiles(appTitle: string): Record<string, string> {
  return {
    "package.json": `{
  "name": "mind-built-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.7"
  }
}
`,
    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Relative base so the built site works under a pod sub-path
// (e.g. /alice/public/sites/<slug>/).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
`,
    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appTitle)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    "src/index.css": `@import "tailwindcss";

/* Enable class-based dark mode. Tailwind v4 defaults the \`dark:\` variant to
   \`prefers-color-scheme\` (the OS theme), so a \`.dark\` class toggled in React
   would do nothing. This makes \`dark:*\` utilities respond to a \`.dark\` class
   on any ancestor — the standard pattern an in-app dark-mode toggle uses. */
@custom-variant dark (&:where(.dark, .dark *));
`,
    "src/App.tsx": `// Holding page shown for the ~minute between "wish submitted" and the
// agent's first build. The coder replaces this file with the real app.
export default function App() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 text-stone-800 flex items-center justify-center p-4 antialiased">
      <style>{\`
        @keyframes mind-slide { 0% { left: -40% } 100% { left: 100% } }
        @keyframes mind-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
      \`}</style>

      <section className="w-full max-w-lg rounded-3xl bg-white/80 backdrop-blur shadow-xl shadow-amber-900/5 ring-1 ring-amber-200/60 p-8 sm:p-10">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
            <span className="text-lg">✦</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-600">
            building with mind
          </p>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-stone-900">
          ${escapeHtml(appTitle)}
        </h1>
        <p className="mt-3 text-stone-600">
          We&rsquo;re building your app right now. This usually takes a minute or
          two — <span className="font-medium text-stone-800">follow the agent&rsquo;s
          progress in the chat</span>. This page updates itself the moment your
          app is ready; no need to refresh.
        </p>

        {/* indeterminate progress bar */}
        <div className="relative mt-7 h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
          <div
            className="absolute top-0 h-full w-2/5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            style={{ animation: "mind-slide 1.3s ease-in-out infinite" }}
          />
        </div>

        {/* what's happening */}
        <ol className="mt-7 space-y-3 text-sm">
          <li className="flex items-center gap-3 text-stone-500">
            <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-600 text-[11px]">✓</span>
            Project &amp; starter app set up
          </li>
          <li className="flex items-center gap-3 font-medium text-stone-800">
            <span
              className="size-2.5 rounded-full bg-amber-500"
              style={{ animation: "mind-pulse 1.2s ease-in-out infinite" }}
            />
            The agent is writing your code
          </li>
          <li className="flex items-center gap-3 text-stone-400">
            <span className="size-2.5 rounded-full border border-stone-300" />
            Building &amp; publishing your preview
          </li>
        </ol>

        <p className="mt-8 text-xs text-stone-400">
          Your app and its code live in your own Solid pod.
        </p>
      </section>
    </main>
  );
}
`,
    ".mind/workflow.yml": `run:
  - npm install --no-audit --no-fund
  - npm run build
publish: dist
timeout: 1200
`,
    ".gitignore": `node_modules
dist
*.log
`,
    "README.md": `# ${appTitle}

Built with [mind-builder](../../). Source is a Vite + React + Tailwind app;
the mind-codespaces bridge runs \`.mind/workflow.yml\` on every push to \`main\`
and publishes \`dist/\` to a Solid pod.
`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Initialize a git repo from the scaffold and push it to the bridge's
 * Smart-HTTP endpoint on `main`. Mirrors the push flow in
 * mind-codespaces-v0/scripts/seed-demo.ts. Returns once `git push` completes;
 * the bridge's post-receive hook then runs the workflow asynchronously.
 */
export async function pushScaffold(args: {
  owner: string;
  name: string;
  token: string;
  appTitle: string;
}): Promise<void> {
  const { owner, name, token, appTitle } = args;
  const files = scaffoldFiles(appTitle);
  const dir = await mkdtemp(join(tmpdir(), `mind-builder-${name}-`));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const filePath = join(dir, rel);
      const parent = filePath.slice(0, filePath.lastIndexOf("/"));
      if (parent && parent !== dir) await mkdir(parent, { recursive: true });
      await writeFile(filePath, content, "utf-8");
    }
    await git(["init", "-b", "main"], dir);
    await git(["config", "user.email", "builder@mind-builder.local"], dir);
    await git(["config", "user.name", "mind-builder"], dir);
    await git(["add", "."], dir);
    await git(["commit", "-m", "scaffold: Vite + React + Tailwind starter"], dir);
    const origin = new URL(bridgeUrl);
    const remote = `${origin.protocol}//me:${token}@${origin.host}/api/git/${owner}/${name}.git`;
    await git(["remote", "add", "origin", remote], dir);
    await git(["push", "-u", "origin", "main"], dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function git(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(" ")} exited ${code}: ${stderr}`));
    });
  });
}
