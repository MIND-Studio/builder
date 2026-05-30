/**
 * Derive pod coordinates from a WebID. Works for CSS-style WebIDs of the form
 * `{podBase}{owner}/profile/card#me`. Used by both the browser (room URLs) and
 * the server orchestrator (repo owner + targetContainer).
 *
 * These are heuristics that match the local CSS layout the prototypes use; a
 * production build would dereference the WebID profile's `pim:storage` instead
 * (the bridge already verifies podRoot against the profile on repo creation).
 */

/** The owner slug — the first path segment of the WebID. */
export function ownerFromWebId(webId: string): string {
  const u = new URL(webId);
  const seg = u.pathname.split("/").filter(Boolean)[0];
  if (!seg) throw new Error(`cannot derive owner from WebID: ${webId}`);
  return seg;
}

/** The pod root container, e.g. `http://localhost:3011/alice/`. */
export function podRootFromWebId(webId: string): string {
  const u = new URL(webId);
  const owner = ownerFromWebId(webId);
  return `${u.origin}/${owner}/`;
}

/** Conversation room URL for a project (no trailing slash; chat.ts adds it). */
export function projectRoomUrl(podRoot: string, slug: string): string {
  return `${podRoot}builder/projects/${slug}/chat`;
}

/** Authoritative project record URL. */
export function projectRecordUrl(podRoot: string, slug: string): string {
  return `${podRoot}builder/projects/${slug}/project.ttl`;
}

/** Pages target container for a project's published site. */
export function projectTargetContainer(podRoot: string, slug: string): string {
  return `${podRoot}public/sites/${slug}/`;
}

/** Public preview URL (the published index). */
export function previewUrlFor(targetContainer: string): string {
  return targetContainer.endsWith("/")
    ? `${targetContainer}index.html`
    : `${targetContainer}/index.html`;
}
