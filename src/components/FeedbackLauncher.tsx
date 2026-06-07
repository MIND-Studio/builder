"use client";

import { FeedbackWidget } from "@mind-studio/core/feedback";
import { feedbackInbox } from "@/lib/config";
import { useSession } from "@/lib/solid/session";

/**
 * Mounts the floating 💬 feedback widget on every Builder page. Bridges the
 * app's Inrupt pod session to the storage-agnostic widget: `webId` and the
 * DPoP-bound `fetch` come from `useSession()`. Both are optional — until the
 * session resolves (or for signed-out users) the widget submits anonymously,
 * which the public-append inbox accepts.
 */
export function FeedbackLauncher() {
  const { webid, fetch } = useSession();
  return (
    <FeedbackWidget
      appKey="builder"
      inbox={feedbackInbox}
      fetch={fetch ?? undefined}
      webId={webid}
      variant="floating"
    />
  );
}
