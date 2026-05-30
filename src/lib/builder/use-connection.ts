"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConnState = {
  /** null = still checking */
  connected: boolean | null;
  connectUrl: string;
  /** Open the bridge's /connect in a popup and poll until authorized. */
  connect: () => void;
  busy: boolean;
};

/**
 * Tracks whether the bridge can publish to this user's pod, and drives the
 * one-time authorization. The publisher needs a delegated pod token; a brand-
 * new builder user hasn't granted it, so without this they'd hit a failed
 * publish. We fold that grant into onboarding: open `/connect` in a popup and
 * poll until the bridge reports the identity, then proceed. SSO means no second
 * password, and "remember this client" makes it silent on later logins.
 */
export function usePodConnection(webid: string | null): ConnState {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectUrl, setConnectUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async (): Promise<boolean> => {
    if (!webid) return false;
    try {
      const res = await fetch("/api/pod-connected", { headers: { "x-mind-webid": webid } });
      const data = (await res.json()) as { connected: boolean; connectUrl: string };
      setConnectUrl(data.connectUrl);
      setConnected(data.connected);
      return data.connected;
    } catch {
      setConnected(true); // fail open — don't block on a flaky check
      return true;
    }
  }, [webid]);

  useEffect(() => {
    void check();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [check]);

  const connect = useCallback(() => {
    if (!connectUrl) return;
    setBusy(true);
    window.open(connectUrl, "mind-connect", "popup,width=520,height=720");
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const ok = await check();
      if (ok) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setBusy(false);
      }
    }, 2000);
  }, [connectUrl, check]);

  return { connected, connectUrl, connect, busy };
}
