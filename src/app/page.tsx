"use client";

import { MindLoginCard, writeLastIdentity } from "@mind-studio/core";
import { Badge, Card, CardContent } from "@mind-studio/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, oidcIssuer } from "@/lib/config";
import { useSession } from "@/lib/solid/session";

export default function HomePage() {
  const { webid, loggedIn, loading, signIn } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && loggedIn && webid) {
      writeLastIdentity(APP_NAME, {
        webId: webid,
        displayName: webid.split("/").filter(Boolean).pop(),
      });
      router.replace("/build");
    }
  }, [loading, loggedIn, webid, router]);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-20">
      <Aura />
      <TopBar />

      {/* ---- Hero ---- */}
      <section className="grid items-center gap-12 pt-4 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-10">
        <div className="fade-up" style={{ animationDelay: "0.05s" }}>
          <Badge
            variant="secondary"
            className="mb-5 gap-2 rounded-full px-3 py-1 text-xs font-medium"
          >
            <span className="soft-pulse inline-block size-1.5 rounded-full bg-primary" />
            Build anything, just by asking
          </Badge>

          <h1 className="text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Wish it.
            <br />
            <span className="brand-text">We build it.</span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
            Tell us the website or app you wish you had — in your own everyday words. We make it
            real and hand you a link you can open and share.{" "}
            <span className="font-medium text-foreground">
              No coding. No setup. Nothing to install.
            </span>{" "}
            It’s for everyone.
          </p>

          <div className="mt-8 max-w-md">
            <MindLoginCard
              appName={APP_NAME}
              defaultIssuer={oidcIssuer}
              onLogin={async ({ issuer }) => {
                await signIn(issuer);
              }}
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {loading
                ? "Getting things ready…"
                : webid
                  ? "You’re signed in — taking you to your builds…"
                  : "Sign in safely with your own account. No new password to remember."}
            </p>
          </div>
        </div>

        {/* Friendly product mock */}
        <div className="fade-up" style={{ animationDelay: "0.22s" }}>
          <AppMock />
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section
        id="how"
        aria-label="How it works"
        className="fade-up mt-24 scroll-mt-20 sm:mt-28"
        style={{ animationDelay: "0.32s" }}
      >
        <SectionHeading kicker="So simple" title="Three steps. One conversation." />
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          <StepCard
            n="1"
            title="Say what you want"
            body="Type it like you’d say it to a friend — “a little website for my bakery” or “a timer that keeps me focused.”"
          />
          <StepCard
            n="2"
            title="We build it for you"
            body="Behind the scenes, it gets built and put online. You just watch it come together — no jargon, no waiting around."
          />
          <StepCard
            n="3"
            title="See it live & change it"
            body="Your app appears with a link to share. Want something different? Just ask again, and it updates."
          />
        </div>
      </section>

      {/* ---- Why people love it ---- */}
      <section
        aria-label="Why it's for everyone"
        className="fade-up mt-20 sm:mt-24"
        style={{ animationDelay: "0.42s" }}
      >
        <SectionHeading kicker="For everyone" title="No experience needed" />
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            emoji="💬"
            title="Just talk"
            body="If you can describe it, you can build it. Plain words are all it takes — no menus to learn."
          />
          <FeatureCard
            emoji="⚡"
            title="Ready in minutes"
            body="Watch your idea turn into a real, working website or app while you wait."
          />
          <FeatureCard
            emoji="🔒"
            title="Yours to keep"
            body="Everything we make is saved to your own private space. It belongs to you — open or move it anytime."
          />
          <FeatureCard
            emoji="🔁"
            title="Change your mind freely"
            body="New colour? Different words? A whole new section? Just ask, and it’s done."
          />
        </div>
      </section>

      {/* ---- Closing ---- */}
      <section className="fade-up mt-20 sm:mt-24" style={{ animationDelay: "0.5s" }}>
        <Card className="overflow-hidden border-primary/20 bg-primary/5 text-center">
          <CardContent className="px-8 py-10 sm:px-12 sm:py-14">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What will you make today?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Sign in above and type your very first wish. A page for your business, a fun game, a
              tool you’ve always wanted — start anywhere.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                "a website for my honey",
                "a focus timer",
                "a birthday invitation page",
                "a tic-tac-toe game",
              ].map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="rounded-full px-3 py-1.5 text-[13px] font-normal"
                >
                  “{s}”
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="mt-16 text-center text-xs text-muted-foreground">
        <p>Mind Builder — building made friendly. Everything you make stays yours.</p>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <header className="flex items-center justify-between py-7">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-xl bg-primary text-[15px] text-primary-foreground shadow-sm">
          ✦
        </span>
        <span className="text-lg font-bold tracking-tight">Mind Builder</span>
      </div>
      <nav className="hidden items-center gap-6 text-[13px] text-muted-foreground sm:flex">
        <a className="transition hover:text-foreground" href="#how">
          How it works
        </a>
        <Badge variant="secondary" className="gap-1.5">
          <span className="soft-pulse inline-block size-1.5 rounded-full bg-primary" />
          Early access
        </Badge>
      </nav>
    </header>
  );
}

function Aura() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="aura absolute -top-24 left-1/4 size-[34rem] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div
        className="aura absolute -right-20 top-1/3 size-[26rem] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%)",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">{kicker}</div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card className="transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-5">
        <span className="grid size-9 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
          {n}
        </span>
        <h3 className="mt-4 text-[15px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function FeatureCard({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <Card className="transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-xl">
          {emoji}
        </span>
        <h3 className="mt-4 text-[14px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

/** A friendly "browser window" showing the build flow, lightly animated. */
function AppMock() {
  return (
    <Card className="float-y mx-auto max-w-md overflow-hidden p-0 shadow-xl">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-primary/50" />
        <span className="size-2.5 rounded-full bg-primary/30" />
        <span className="ml-3 truncate text-xs text-muted-foreground">Mind Builder</span>
      </div>

      <div className="space-y-3 px-4 py-4">
        {/* user wish */}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] text-primary-foreground">
            build me a little website for my honey from my bees
          </div>
        </div>

        {/* working */}
        <div className="flex items-start gap-2.5">
          <Bee />
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
            <span className="demo-dot inline-block size-1.5 rounded-full bg-primary" />
            <span
              className="demo-dot inline-block size-1.5 rounded-full bg-primary"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="demo-dot inline-block size-1.5 rounded-full bg-primary"
              style={{ animationDelay: "0.3s" }}
            />
            <span className="ml-1.5 text-[12px] text-muted-foreground">Building your website…</span>
          </div>
        </div>

        {/* ready card */}
        <div className="flex items-start gap-2.5">
          <Bee />
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl rounded-bl-md border bg-card">
            <div className="flex items-center gap-2 px-3.5 pt-3">
              <span className="soft-pulse inline-block size-2 rounded-full bg-primary" />
              <span className="text-[11px] font-semibold text-primary">
                Your website is ready 🎉
              </span>
            </div>
            {/* mini rendered "site" */}
            <div className="mx-3.5 mt-2.5 overflow-hidden rounded-lg border bg-background">
              <div className="bg-primary/10 px-3 py-4">
                <div className="text-[12px] font-bold text-foreground">🐝 Golden Hive Honey</div>
                <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-primary/30" />
                <div className="mt-1 h-1.5 w-1/2 rounded-full bg-muted-foreground/30" />
                <div className="mt-2.5 inline-block rounded-md bg-primary px-2.5 py-1 text-[9px] font-semibold text-primary-foreground">
                  Order a jar
                </div>
              </div>
            </div>
            <div className="px-3.5 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
                Open my website <span aria-hidden>↗</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Bee() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-primary text-[13px] text-primary-foreground">
      ✦
    </span>
  );
}
