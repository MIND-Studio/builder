import {
  buildThing,
  createSolidDataset,
  createThing,
  getInteger,
  getSolidDataset,
  getStringNoLocale,
  getThingAll,
  getUrl,
  saveSolidDatasetAt,
  setThing,
} from "@inrupt/solid-client";
import type { AuthenticatedFetch } from "./chat";
import { projectRecordUrl } from "./pod";

// The authoritative per-project record. The sqlite cache mirrors this; the pod
// copy is what lets a project follow the user across devices.
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const MIND_PROJECT = "https://mind.dev/ns#BuilderProject";
const MIND_SLUG = "https://mind.dev/ns#slug";
const MIND_REPO_OWNER = "https://mind.dev/ns#repoOwner";
const MIND_REPO_NAME = "https://mind.dev/ns#repoName";
const MIND_PAGES_URL = "https://mind.dev/ns#pagesUrl";
const MIND_TARGET = "https://mind.dev/ns#targetContainer";
const MIND_LAST_ISSUE = "https://mind.dev/ns#lastIssue";
const MIND_STATUS = "https://mind.dev/ns#status";
const DCT_TITLE = "http://purl.org/dc/terms/title";
const DCT_CREATED = "http://purl.org/dc/terms/created";

export type PodProject = {
  slug: string;
  title: string;
  repoOwner: string;
  repoName: string;
  pagesUrl: string;
  targetContainer: string;
  lastIssue: number | null;
  status: string;
};

export async function writeProjectRecord(
  podRoot: string,
  p: PodProject,
  fetch: AuthenticatedFetch,
): Promise<void> {
  const url = projectRecordUrl(podRoot, p.slug);
  const subject = `${url}#this`;
  let b = buildThing(createThing({ url: subject }))
    .addUrl(RDF_TYPE, MIND_PROJECT)
    .addStringNoLocale(MIND_SLUG, p.slug)
    .addStringNoLocale(DCT_TITLE, p.title)
    .addStringNoLocale(MIND_REPO_OWNER, p.repoOwner)
    .addStringNoLocale(MIND_REPO_NAME, p.repoName)
    .addStringNoLocale(MIND_PAGES_URL, p.pagesUrl)
    .addStringNoLocale(MIND_TARGET, p.targetContainer)
    .addStringNoLocale(MIND_STATUS, p.status)
    .addDatetime(DCT_CREATED, new Date());
  if (p.lastIssue !== null) b = b.addInteger(MIND_LAST_ISSUE, p.lastIssue);
  await saveSolidDatasetAt(url, setThing(createSolidDataset(), b.build()), { fetch });
}

export async function readProjectRecord(
  podRoot: string,
  slug: string,
  fetch: AuthenticatedFetch,
): Promise<PodProject | null> {
  try {
    const url = projectRecordUrl(podRoot, slug);
    const dataset = await getSolidDataset(url, { fetch });
    for (const t of getThingAll(dataset)) {
      if (getUrl(t, RDF_TYPE) !== MIND_PROJECT) continue;
      return {
        slug: getStringNoLocale(t, MIND_SLUG) ?? slug,
        title: getStringNoLocale(t, DCT_TITLE) ?? slug,
        repoOwner: getStringNoLocale(t, MIND_REPO_OWNER) ?? "",
        repoName: getStringNoLocale(t, MIND_REPO_NAME) ?? "",
        pagesUrl: getStringNoLocale(t, MIND_PAGES_URL) ?? "",
        targetContainer: getStringNoLocale(t, MIND_TARGET) ?? "",
        lastIssue: getInteger(t, MIND_LAST_ISSUE) ?? null,
        status: getStringNoLocale(t, MIND_STATUS) ?? "published",
      };
    }
    return null;
  } catch {
    return null;
  }
}
