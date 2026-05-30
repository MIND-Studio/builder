"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Textarea } from "@mind-studio/ui";

const MAX_LEN = 4000;

/** Wish input. Enter to send, Shift+Enter for newline. */
export function Composer({
  onSend,
  disabled = false,
  placeholder = "Describe what you'd like to build…",
}: {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 192)}px`;
  }, [draft]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    setDraft("");
    try {
      await onSend(body);
    } catch (err) {
      setDraft(body);
      // eslint-disable-next-line no-console
      console.error("send failed", err);
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      void submit();
    }
  }

  const trimmedLen = draft.trim().length;
  const canSend = !disabled && !sending && trimmedLen > 0 && trimmedLen <= MAX_LEN;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="border-t bg-card px-4 py-3"
    >
      <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={onKeyDown}
          disabled={disabled || sending}
          rows={1}
          placeholder={placeholder}
          className="min-h-[24px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          data-testid="wish-input"
        />
        <Button
          type="submit"
          disabled={!canSend}
          size="sm"
          aria-label="Send"
          className="shrink-0 rounded-xl"
          data-testid="wish-send"
        >
          {sending ? "Sending…" : "Build it"}
          {!sending ? <span aria-hidden>↑</span> : null}
        </Button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
        Press Enter to send · Shift+Enter for a new line
      </p>
    </form>
  );
}
