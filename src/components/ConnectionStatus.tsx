export type ConnState = "connecting" | "connected" | "polling" | "error";

/** A small, friendly live-connection indicator shown in the build header. */
export function ConnectionStatus({
  state,
  detail,
}: {
  state: ConnState;
  detail?: string;
}): React.JSX.Element {
  const { label, tone, pulse } = describe(state);
  return (
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={detail ?? label}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${pulse ? "soft-pulse" : ""}`}
        style={{ background: tone }}
      />
      <span>{label}</span>
    </div>
  );
}

function describe(state: ConnState): { label: string; tone: string; pulse: boolean } {
  switch (state) {
    case "connecting":
      return { label: "Connecting…", tone: "var(--primary)", pulse: true };
    case "connected":
      // Not "Live" — next to a failed build that reads as "your site is live".
      return { label: "Connected", tone: "var(--primary)", pulse: true };
    case "polling":
      return { label: "Updating…", tone: "var(--primary)", pulse: true };
    case "error":
      return { label: "Offline", tone: "var(--destructive)", pulse: false };
  }
}
