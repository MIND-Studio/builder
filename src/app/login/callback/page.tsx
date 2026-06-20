"use client";

import { EVENTS, events, handleIncomingRedirect } from "@inrupt/solid-client-authn-browser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    // A silent session restore (refresh / deep link on any signed-in page)
    // round-trips through this callback too; the library reports the URL the
    // user was actually on — honor it so /build/{slug} survives a refresh.
    let target = "/build";
    const onRestore = (url: string) => {
      try {
        const u = new URL(url, window.location.origin);
        if (u.pathname !== "/login/callback") {
          target = `${u.pathname}${u.search}${u.hash}`;
        }
      } catch {
        // keep default
      }
    };
    events().on(EVENTS.SESSION_RESTORED, onRestore);
    (async () => {
      try {
        await handleIncomingRedirect({ restorePreviousSession: false });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("OIDC callback failed", err);
      }
      if (!cancelled) {
        router.replace(target);
      }
    })();
    return () => {
      cancelled = true;
      events().off(EVENTS.SESSION_RESTORED, onRestore);
    };
  }, [router]);

  return <main className="mx-auto max-w-md px-6 py-16 text-muted-foreground">Signing you in…</main>;
}
