import {
  buildThing,
  createSolidDataset,
  createThing,
  getContainedResourceUrlAll,
  getDatetime,
  getSolidDataset,
  getStringNoLocale,
  getThing,
  getThingAll,
  getUrl,
  type SolidDataset,
  saveSolidDatasetAt,
  setThing,
} from "@inrupt/solid-client";
import type { MessageKind } from "@/lib/builder/types";
import { ulid } from "@/lib/util/ulid";

// SolidOS long-chat vocabulary (interop with the SolidOS chat-pane), plus a
// small `mind:` extension to type builder status / preview-card messages
// without breaking the standard predicates.
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MEETING_LONG_CHAT = "http://www.w3.org/ns/pim/meeting#LongChat";
const MEETING_MESSAGE = "http://www.w3.org/ns/pim/meeting#message";
const SIOC_CONTENT = "http://rdfs.org/sioc/ns#content";
const FOAF_MAKER = "http://xmlns.com/foaf/0.1/maker";
const DCT_CREATED = "http://purl.org/dc/terms/created";
const DCT_TITLE = "http://purl.org/dc/terms/title";
const DCT_CREATOR = "http://purl.org/dc/terms/creator";
const MIND_MESSAGE_KIND = "https://mind.dev/ns#messageKind";
const MIND_PREVIEW_URL = "https://mind.dev/ns#previewUrl";

export type AuthenticatedFetch = typeof globalThis.fetch;

export type ChatMessage = {
  url: string;
  body: string;
  author: string;
  createdAtIso: string;
  kind: MessageKind;
  previewUrl?: string;
};

export type RoomMeta = {
  url: string;
  title: string;
  creator: string;
  createdAtIso: string;
};

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function utcParts(d: Date): { y: string; m: string; day: string } {
  return {
    y: String(d.getUTCFullYear()),
    m: String(d.getUTCMonth() + 1).padStart(2, "0"),
    day: String(d.getUTCDate()).padStart(2, "0"),
  };
}

export function dayContainerUrl(roomUrl: string, d: Date = new Date()): string {
  const { y, m, day } = utcParts(d);
  return `${trimSlash(roomUrl)}/${y}/${m}/${day}/`;
}

export function dayFileUrl(roomUrl: string, d: Date = new Date()): string {
  return `${dayContainerUrl(roomUrl, d)}chat.ttl`;
}

export function roomIndexUrl(roomUrl: string): string {
  return `${trimSlash(roomUrl)}/index.ttl`;
}

/** Idempotently create the room index declaring the long-chat channel. */
export async function ensureRoom(
  roomUrl: string,
  title: string,
  creatorWebid: string,
  fetch: AuthenticatedFetch,
): Promise<void> {
  const indexUrl = roomIndexUrl(roomUrl);
  try {
    await getSolidDataset(indexUrl, { fetch });
    return;
  } catch {
    // create below
  }
  const subject = `${indexUrl}#this`;
  const thing = buildThing(createThing({ url: subject }))
    .addUrl(RDF_TYPE, MEETING_LONG_CHAT)
    .addStringNoLocale(DCT_TITLE, title)
    .addUrl(DCT_CREATOR, creatorWebid)
    .addDatetime(DCT_CREATED, new Date())
    .build();
  await saveSolidDatasetAt(indexUrl, setThing(createSolidDataset(), thing), { fetch });
}

/** Idempotently create today's empty day file (required before subscribing). */
export async function ensureTodayFile(roomUrl: string, fetch: AuthenticatedFetch): Promise<string> {
  const dayUrl = dayFileUrl(roomUrl);
  try {
    await getSolidDataset(dayUrl, { fetch });
    return dayUrl;
  } catch {
    // create below
  }
  const subject = `${dayUrl}#this`;
  const thing = buildThing(createThing({ url: subject }))
    .addUrl(RDF_TYPE, MEETING_LONG_CHAT)
    .build();
  await saveSolidDatasetAt(dayUrl, setThing(createSolidDataset(), thing), { fetch });
  return dayUrl;
}

/** Append a message (any kind) to today's chat.ttl. */
export async function postMessage(
  roomUrl: string,
  args: {
    body: string;
    author: string;
    kind?: MessageKind;
    previewUrl?: string;
  },
  fetch: AuthenticatedFetch,
): Promise<ChatMessage> {
  const dayUrl = await ensureTodayFile(roomUrl, fetch);
  let dataset = await getSolidDataset(dayUrl, { fetch });

  const id = ulid();
  const msgSubject = `${dayUrl}#msg-${id}`;
  const createdAt = new Date();
  const kind: MessageKind = args.kind ?? "user-wish";

  const channelSubject = `${dayUrl}#this`;
  const existingChannel = getThing(dataset, channelSubject);
  const channelBuilder = existingChannel
    ? buildThing(existingChannel)
    : buildThing(createThing({ url: channelSubject })).addUrl(RDF_TYPE, MEETING_LONG_CHAT);
  dataset = setThing(dataset, channelBuilder.addUrl(MEETING_MESSAGE, msgSubject).build());

  let mb = buildThing(createThing({ url: msgSubject }))
    .addStringNoLocale(SIOC_CONTENT, args.body)
    .addUrl(FOAF_MAKER, args.author)
    .addDatetime(DCT_CREATED, createdAt)
    .addStringNoLocale(MIND_MESSAGE_KIND, kind);
  if (args.previewUrl) mb = mb.addStringNoLocale(MIND_PREVIEW_URL, args.previewUrl);
  dataset = setThing(dataset, mb.build());

  await saveSolidDatasetAt(dayUrl, dataset, { fetch });

  return {
    url: msgSubject,
    body: args.body,
    author: args.author,
    createdAtIso: createdAt.toISOString(),
    kind,
    previewUrl: args.previewUrl,
  };
}

/** Pull every well-formed message out of one day's dataset (unsorted). */
function messagesFromDataset(dataset: SolidDataset): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of getThingAll(dataset)) {
    const body = getStringNoLocale(t, SIOC_CONTENT);
    const author = getUrl(t, FOAF_MAKER);
    const createdAt = getDatetime(t, DCT_CREATED);
    if (!body || !author || !createdAt) continue;
    const kind = (getStringNoLocale(t, MIND_MESSAGE_KIND) as MessageKind | null) ?? "user-wish";
    const previewUrl = getStringNoLocale(t, MIND_PREVIEW_URL) ?? undefined;
    out.push({
      url: t.url,
      body,
      author,
      createdAtIso: createdAt.toISOString(),
      kind,
      previewUrl,
    });
  }
  return out;
}

/** Read all messages from today's chat.ttl, sorted by created time ascending. */
export async function listTodayMessages(
  roomUrl: string,
  fetch: AuthenticatedFetch,
): Promise<ChatMessage[]> {
  const dayUrl = dayFileUrl(roomUrl);
  try {
    const dataset = await getSolidDataset(dayUrl, { fetch });
    const out = messagesFromDataset(dataset);
    out.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
    return out;
  } catch {
    return [];
  }
}

/**
 * Read the FULL conversation across every day file in the room, sorted by
 * created time ascending. The long-chat layout nests messages under
 * `chat/YYYY/MM/DD/chat.ttl`, so we walk the room container tree, read every
 * `chat.ttl` leaf, and merge. `listTodayMessages` only sees today's file — a
 * project reopened on a later day would otherwise show an empty conversation
 * even though its wish history is sitting in the pod under earlier dates.
 */
export async function listAllMessages(
  roomUrl: string,
  fetch: AuthenticatedFetch,
): Promise<ChatMessage[]> {
  // Breadth-first walk of the room container, collecting chat.ttl leaves.
  // Depth is bounded by the YYYY/MM/DD layout; the visit cap is a guard
  // against an unexpectedly deep/large tree.
  const queue: string[] = [`${trimSlash(roomUrl)}/`];
  const dayFiles: string[] = [];
  let visited = 0;
  while (queue.length && visited < 200) {
    const current = queue.shift()!;
    visited++;
    const container = await getSolidDataset(current, { fetch }).catch(() => null);
    if (!container) continue; // container missing (e.g. brand-new room) — skip
    for (const childUrl of getContainedResourceUrlAll(container)) {
      if (childUrl.endsWith("/")) queue.push(childUrl);
      else if (childUrl.endsWith("chat.ttl")) dayFiles.push(childUrl);
    }
  }

  const datasets = await Promise.all(
    dayFiles.map((u) => getSolidDataset(u, { fetch }).catch(() => null)),
  );
  const out: ChatMessage[] = [];
  for (const dataset of datasets) {
    if (dataset) out.push(...messagesFromDataset(dataset));
  }
  out.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso));
  return out;
}

export async function readRoomMeta(
  roomUrl: string,
  fetch: AuthenticatedFetch,
): Promise<RoomMeta | null> {
  try {
    const indexUrl = roomIndexUrl(roomUrl);
    const dataset = await getSolidDataset(indexUrl, { fetch });
    const t = getThing(dataset, `${indexUrl}#this`);
    if (!t) return null;
    return {
      url: roomUrl,
      title: getStringNoLocale(t, DCT_TITLE) ?? "(untitled)",
      creator: getUrl(t, DCT_CREATOR) ?? "",
      createdAtIso: getDatetime(t, DCT_CREATED)?.toISOString() ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
