"use client";

import { useEffect, useState } from "react";
import {
  getDefaultSession,
  handleIncomingRedirect,
  login,
  logout,
  type Session,
} from "@inrupt/solid-client-authn-browser";

const APP_NAME = "Mind Builder";

/**
 * Client-side Inrupt session hook. Restores session via
 * `handleIncomingRedirect({ restorePreviousSession: true })` on mount and
 * exposes the current WebID + login/logout actions. The DPoP-bound `fetch`
 * is used only for POD reads/writes (chat, project records) — all
 * codespaces-bridge calls go through the builder's own server API routes.
 */
export function useSession(): {
  webid: string | null;
  loggedIn: boolean;
  loading: boolean;
  fetch: typeof globalThis.fetch | null;
  signIn: (issuer: string) => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await handleIncomingRedirect({ restorePreviousSession: true });
      } catch {
        // Restore failed — proceed as signed-out.
      }
      if (!cancelled) {
        setSession(getDefaultSession());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(issuer: string) {
    await login({
      oidcIssuer: issuer,
      redirectUrl:
        typeof window !== "undefined" ? `${window.location.origin}/login/callback` : "",
      clientName: APP_NAME,
    });
  }

  async function signOut() {
    await logout();
    setSession(getDefaultSession());
  }

  return {
    webid: session?.info?.webId ?? null,
    loggedIn: !!session?.info?.isLoggedIn,
    loading,
    fetch: session?.fetch ?? null,
    signIn,
    signOut,
  };
}
