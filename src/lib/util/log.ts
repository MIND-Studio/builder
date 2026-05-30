type LogFields = Record<string, unknown>;

/**
 * Minimal structured logger. Never log wish text, message bodies, push
 * tokens, or pod credentials. OK to log: WebID, route, repo slug, status,
 * latency, high-level event type (e.g. "builder.wish.created").
 */
export const log = {
  debug(fields: LogFields, msg: string) {
    if (typeof window === "undefined") {
      // eslint-disable-next-line no-console
      console.debug(JSON.stringify({ level: "debug", msg, ...fields }));
    }
  },
  info(fields: LogFields, msg: string) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: "info", msg, ...fields }));
  },
  warn(fields: LogFields, msg: string) {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({ level: "warn", msg, ...fields }));
  },
  error(fields: LogFields, msg: string) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", msg, ...fields }));
  },
};
