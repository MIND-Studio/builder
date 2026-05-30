import React from "react";

/**
 * Minimal, dependency-free message renderer (ported from mind-chat-v0):
 *   - Triple-backtick code blocks → <pre>
 *   - Inline code, **bold**, *italic*
 *   - Bare http(s) URLs → <a target="_blank">
 * Output is plain React (no dangerouslySetInnerHTML).
 */
export function MessageBody({ body }: { body: string }): React.JSX.Element {
  const blocks = parseBlocks(body);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === "code") {
          return (
            <pre
              key={i}
              className="mt-1 mb-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground"
            >
              <code>{b.body}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap break-words leading-relaxed">
            {renderInline(b.body)}
          </p>
        );
      })}
    </>
  );
}

type Block = { kind: "p"; body: string } | { kind: "code"; lang: string; body: string };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const out: Block[] = [];
  let inFence = false;
  let fenceLang = "";
  let buffer: string[] = [];
  let paraBuffer: string[] = [];

  function flushPara() {
    if (paraBuffer.length === 0) return;
    out.push({ kind: "p", body: paraBuffer.join("\n") });
    paraBuffer = [];
  }

  for (const line of lines) {
    const fenceMatch = /^\s*```(\w*)\s*$/.exec(line);
    if (fenceMatch) {
      if (inFence) {
        out.push({ kind: "code", lang: fenceLang, body: buffer.join("\n") });
        buffer = [];
        inFence = false;
        fenceLang = "";
      } else {
        flushPara();
        inFence = true;
        fenceLang = fenceMatch[1] ?? "";
      }
      continue;
    }
    if (inFence) buffer.push(line);
    else paraBuffer.push(line);
  }
  if (inFence) {
    paraBuffer.push("```" + (fenceLang ? fenceLang : ""), ...buffer);
  }
  flushPara();
  return out;
}

const INLINE_RE = /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s](?:[^*]*[^*\s])?\*)|((?<![A-Za-z0-9])_[^_\s](?:[^_]*[^_\s])?_(?![A-Za-z0-9]))|(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const matched = m[0];
    if (m[1]) {
      out.push(
        <code
          key={`c${i++}`}
          className="rounded border bg-muted px-1 font-mono text-[12.5px] text-primary"
        >
          {matched.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(
        <strong key={`bi${i++}`} className="font-semibold text-foreground">
          <em className="italic">{matched.slice(3, -3)}</em>
        </strong>,
      );
    } else if (m[3] || m[4]) {
      out.push(
        <strong key={`b${i++}`} className="font-semibold text-foreground">
          {matched.slice(2, -2)}
        </strong>,
      );
    } else if (m[5] || m[6]) {
      out.push(
        <em key={`i${i++}`} className="italic">
          {matched.slice(1, -1)}
        </em>,
      );
    } else if (m[7]) {
      out.push(
        <a
          key={`u${i++}`}
          href={matched}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all text-primary underline-offset-2 hover:underline"
        >
          {matched}
        </a>,
      );
    }
    last = m.index + matched.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
