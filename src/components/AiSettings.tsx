"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@mind-studio/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AiCatalogEntry,
  AiProviderName,
  AiSettings as AiSettingsData,
} from "@/lib/builder/bridge-client";

/**
 * "Your AI" — bring-your-own-key settings. Lets the user store their own
 * AI key (held encrypted server-side; never readable back) and pick which
 * AI builds their apps. Without a key, builds use the free built-in AI.
 */
export function AiSettings({ webid }: { webid: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AiSettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>("openrouter");
  const [keyInput, setKeyInput] = useState("");
  const [model, setModel] = useState<string>("");

  const headers = useMemo(
    () => ({ "content-type": "application/json", "x-mind-webid": webid ?? "" }),
    [webid],
  );

  const load = useCallback(async () => {
    if (!webid) return;
    setError(null);
    try {
      const res = await fetch("/api/ai", { headers: { "x-mind-webid": webid } });
      if (!res.ok) throw new Error("Couldn’t load your AI settings.");
      const next = (await res.json()) as AiSettingsData;
      setData(next);
      const startProvider = next.pref.provider ?? "openrouter";
      setProvider(startProvider);
      setModel(
        next.pref.provider === startProvider && next.pref.model
          ? next.pref.model
          : (next.catalog.find((c) => c.name === startProvider)?.models[0]?.id ?? ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load your AI settings.");
    }
  }, [webid]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const entry: AiCatalogEntry | undefined = data?.catalog.find((c) => c.name === provider);
  const savedKey = data?.providers.find((p) => p.provider === provider);
  const prefIsCustom = data?.pref.provider != null;

  // Keep the model dropdown valid when the user switches provider; keep the
  // saved (possibly off-list) model visible when it matches.
  const modelOptions = useMemo(() => {
    if (!entry) return [];
    const opts = [...entry.models];
    if (model && !opts.some((m) => m.id === model)) {
      opts.unshift({ id: model, label: model });
    }
    return opts;
  }, [entry, model]);

  const onProviderChange = (name: string) => {
    const next = name as AiProviderName;
    setProvider(next);
    setKeyInput("");
    setModel(
      data?.pref.provider === next && data.pref.model
        ? data.pref.model
        : (data?.catalog.find((c) => c.name === next)?.models[0]?.id ?? ""),
    );
  };

  const run = async (fn: () => Promise<Response>, failMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? failMsg);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : failMsg);
    } finally {
      setBusy(false);
    }
  };

  const saveKey = () =>
    run(
      () =>
        fetch(`/api/ai/keys/${provider}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ apiKey: keyInput.trim() }),
        }),
      "Couldn’t save that key.",
    ).then(() => setKeyInput(""));

  const removeKey = () =>
    run(
      () => fetch(`/api/ai/keys/${provider}`, { method: "DELETE", headers }),
      "Couldn’t remove the key.",
    );

  const useThisAi = () =>
    run(
      () =>
        fetch("/api/ai/pref", {
          method: "PUT",
          headers,
          body: JSON.stringify({ provider, model }),
        }),
      "Couldn’t switch your AI.",
    );

  const useFreeAi = () =>
    run(
      () =>
        fetch("/api/ai/pref", {
          method: "PUT",
          headers,
          body: JSON.stringify({ provider: null, model: null }),
        }),
      "Couldn’t switch back.",
    );

  const summaryLine = (() => {
    if (!data) return null;
    if (data.summary.source === "user-pref")
      return `Right now your apps are built with ${data.summary.providerLabel} · ${data.summary.model}.`;
    if (data.summary.source === "env-fallback") {
      const free = data.freeBalance;
      if (typeof free === "number" && free <= 0)
        return "You’ve used your free AI allotment. Add your own key below to keep building.";
      if (typeof free === "number")
        return `Right now your apps are built with the free built-in AI — ${free} free MIND left. Add your own key for a faster, smarter AI.`;
      return "Right now your apps are built with the free built-in AI.";
    }
    return "No AI is set up yet — add a key below to start building.";
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" data-testid="ai-settings-button">
          Your AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your AI</DialogTitle>
          <DialogDescription>
            Mind Builder uses an AI to write your apps. The built-in one is free but can be slow or
            busy. Add your own key to build with a faster, smarter AI — billed to your own account.
          </DialogDescription>
        </DialogHeader>

        {summaryLine ? (
          <p
            className="rounded-lg border bg-muted/40 px-3 py-2 text-[13px] text-foreground"
            data-testid="ai-summary"
          >
            {summaryLine}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {data ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-provider">AI service</Label>
              <Select value={provider} onValueChange={onProviderChange}>
                <SelectTrigger id="ai-provider" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.catalog.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {entry ? (
                <p className="text-xs text-muted-foreground">
                  {entry.blurb}{" "}
                  <a
                    href={entry.keysUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Get a key <span aria-hidden>↗</span>
                  </a>
                </p>
              ) : null}
            </div>

            {savedKey ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <span className="text-sm text-foreground">
                  Key saved <span className="text-muted-foreground">({savedKey.hint})</span>
                </span>
                <Button variant="outline" size="sm" onClick={removeKey} disabled={busy}>
                  Remove
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-key">Your key</Label>
                <div className="flex gap-2">
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    placeholder={entry?.keyShapeHint || "paste your key"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    className="shrink-0"
                    onClick={() => void saveKey()}
                    disabled={busy || keyInput.trim().length < 8}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stored safely — it’s encrypted and can’t be read back, only replaced.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-model">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="ai-model" className="w-full min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Pick a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                      {m.note ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">{m.note}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void useThisAi()}
                disabled={busy || !savedKey || !model}
                data-testid="ai-use-this"
              >
                Use this AI
              </Button>
              {prefIsCustom ? (
                <Button variant="ghost" onClick={() => void useFreeAi()} disabled={busy}>
                  Switch back to the free AI
                </Button>
              ) : null}
            </div>
            {!savedKey ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                Save a key first to switch to this AI.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
