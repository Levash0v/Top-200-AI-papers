/**
 * src/bounty_shared.ts
 * Shared module for scripts 30a-30d
 * Includes: types, helpers, data loading, deduplication, batch publishing
 */

import * as fs   from "fs";
import * as path from "path";
import { Graph, Position, type Op, ContentIds } from "@geoprotocol/geo-sdk";
import { printOps, publishOps, gql } from "./functions";
import { TYPES, PROPERTIES, SPACE_PROPS, COLLECTION_DATA_SOURCE, VIEWS } from "./constants";

export const SPACE_ID   = process.env.DEMO_SPACE_ID ?? "41e851610e13a19441c4d980f2f2ce6b";
function resolveFirstExistingDir(candidates: string[], label: string): string {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  throw new Error(
    `${label} directory not found. Checked: ${candidates.map(c => path.resolve(c)).join(", ")}`
  );
}

const IMAGE_DIR_CANDIDATES = [
  process.env.TOP200_IMAGES_DIR || "",
  "./paper_images_202",
  "../paper_images_202",
  "../geo/geo_tech_demo/paper_images_202",
].filter(Boolean);

export const DATA_DIR   = resolveFirstExistingDir(
  ["./geo_publish_v2_ontology", "../geo_publish_v2_ontology", "./geo_publish_v2", "../geo_publish_v2"],
  "Data",
);
export const IMAGES_DIR = resolveFirstExistingDir(
  IMAGE_DIR_CANDIDATES,
  "Images",
);
export const DRY_RUN    = process.env.DRY_RUN === "1";
export const NETWORK    = "TESTNET" as const;
export const BOUNTY     = "Bounty Top200 AI Papers";
export const PILOT_PAPER_IDS = new Set(
  (process.env.PILOT_PAPER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
export const PILOT_PAPER_ID = process.env.PILOT_PAPER_ID?.trim() || null;
export const PILOT_PAPER_NAME = process.env.PILOT_PAPER_NAME?.trim() || null;

// ─── Types ───────────────────────────────────────────────────────────────────

export type TopicData   = { id: string; name: string; topic_kind: "Domain" | "Concept" | string;
                            description: string | null; parent_topic?: string | null };
export type TagData     = { id: string; name: string; tag_kind: "Era" | "Anchor Type" | string;
                            description: string | null; years?: string | null };
export type VenueData   = { id: string; name: string; short_name: string | null; type: "Conference" | "Journal" | string | null;
                            description: string | null; since: number | null; web_url: string | null };
export type DatasetData = { id: string; name: string; description: string; domain: string | null;
                            year: number | null; size: string | null; web_url: string | null };
export type OrgData     = { id: string; name: string; type: string | null; country: string | null; web_url: string | null };
export type PersonData  = { id: string; name: string; description: string; web_url: string | null };
export type PaperData   = { id: string; name: string; description: string;
                            web_url: string | null; publication_date: string | null;
                            arxiv_url?: string | null; code_url?: string | null;
                            citation_count?: number | null; key_contribution?: string | null;
                            semantic_scholar_url?: string | null; peer_reviewed_by?: string | null;
                            doi?: string | null; abstract?: string | null;
                            primary_venue_name?: string | null; primary_venue_type?: string | null;
                            image_avatar?: string | null; image_cover?: string | null;
                            year?: string | null; year_normalized_citations?: string | null;
                            composite_score?: string | null; graph_degree?: string | null };
export type RelPaperPerson  = { paper_id: string; person_name: string; role: string | null; order: number | null };
export type RelPaperVenue   = { paper_id: string; venue_name: string; venue_class?: string | null };
export type RelPaperDataset = { paper_id: string; dataset_name: string; relation: string };
export type RelPaperTopic   = { paper_id: string; topic_name: string; topic_kind: string; relation: string };
export type RelPaperOrg     = { paper_id: string; org_name: string };
export type RelPaperTag     = { paper_id: string; tag_name: string; tag_kind: string; relation: string };
// Backward-compatible aliases for scripts not yet rewritten.
export type EraData = TagData;
export type DomainData = TopicData;
export type ConceptData = TopicData;
export type RelPaperConcept = RelPaperTopic;
export type RelPaperEra = RelPaperTag;
export type RelPaperDomain = RelPaperTopic;

// ─── Load JSON ───────────────────────────────────────────────────────────────

export function load<T>(file: string): T[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}\nRun: python3 export_schema_to_json.py`);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T[];
}

export function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim();
}

export function filterPapersForPilot<T extends { id: string; name: string }>(papers: T[]): T[] {
  if (PILOT_PAPER_IDS.size === 0 && !PILOT_PAPER_ID && !PILOT_PAPER_NAME) return papers;
  return papers.filter((paper) => {
    if (PILOT_PAPER_IDS.has(paper.id)) return true;
    if (PILOT_PAPER_ID && paper.id === PILOT_PAPER_ID) return true;
    if (PILOT_PAPER_NAME && normalizeEntityName(paper.name) === normalizeEntityName(PILOT_PAPER_NAME)) return true;
    return false;
  });
}

// ─── Fetch name→id map from space ────────────────────────────────────────────

export async function fetchExistingMap(typeId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const data = await gql(`{
      entities(
        spaceId: "${SPACE_ID}"
        typeId:  "${typeId}"
        first:   ${pageSize}
        offset:  ${offset}
        filter:  { name: { isNull: false } }
      ) { id name }
    }`);
    const entities = data?.entities ?? [];
    for (const e of entities) {
      if (e.name) map.set(normalizeEntityName(e.name), e.id);
    }
    if (entities.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}

export async function fetchExistingMaps(typeIds: string[]): Promise<Map<string, string>> {
  const merged = new Map<string, string>();
  for (const typeId of typeIds.filter(Boolean)) {
    const map = await fetchExistingMap(typeId);
    for (const [name, id] of map.entries()) {
      if (!merged.has(name)) merged.set(name, id);
    }
  }
  return merged;
}

type ExistingEntityType = { id: string; name: string };
type ExistingEntityCandidate = { id: string; name: string; types: ExistingEntityType[] };

const ORG_EXACT_REUSE_OVERRIDES: Record<string, string> = {
  "apple": "e7d0727de0f74ac19d5b88f027dd1fde",
  "hugging face": "5e0fff5041e34f6fb21e40018f6cd443",
  "google brain": "143e615b074f4f10b4f850681edd9323",
};

function scoreOrgCandidate(candidate: ExistingEntityCandidate): number {
  const typeNames = candidate.types.map((t) => t.name.toLowerCase());
  if (typeNames.length === 0) return 10;
  if (typeNames.includes("data block")) return 0;
  let score = 10;
  if (typeNames.includes("lab")) score += 6;
  if (typeNames.includes("organization")) score += 5;
  if (typeNames.includes("company")) score += 4;
  if (typeNames.includes("project")) score += 3;
  if (typeNames.includes("provider")) score += 2;
  return score;
}

async function fetchEntityCandidateById(entityId: string): Promise<ExistingEntityCandidate | null> {
  let data: any;
  try {
    data = await gql(
      `query($id: UUID!) {
        entity(id: $id) {
          id
          name
          types { id name }
        }
      }`,
      { id: entityId },
    );
  } catch {
    return null;
  }

  const entity = data?.entity;
  if (!entity?.id || !entity?.name) return null;
  return {
    id: entity.id,
    name: entity.name,
    types: entity.types ?? [],
  };
}

export async function fetchExistingExactOrgMap(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniqueNames = new Map<string, string>();
  for (const name of names) {
    const normalized = normalizeEntityName(name);
    if (!normalized || uniqueNames.has(normalized)) continue;
    uniqueNames.set(normalized, name);
  }

  for (const [normalizedName, originalName] of uniqueNames.entries()) {
    const overrideId = ORG_EXACT_REUSE_OVERRIDES[normalizedName];
    if (overrideId) {
      map.set(normalizedName, overrideId);
      continue;
    }

    let data: any;
    try {
      data = await gql(
        `query($spaceId: UUID!, $name: String!) {
          entities(
            spaceId: $spaceId
            first: 20
            filter: { name: { is: $name } }
          ) { id name }
        }`,
        { spaceId: SPACE_ID, name: originalName },
      );
    } catch {
      continue;
    }

    const rawMatches = (data?.entities ?? []).filter((e: any) => e?.id && e?.name);
    const exactMatches = rawMatches.filter((e: any) => normalizeEntityName(e.name) === normalizedName);
    if (exactMatches.length === 0) continue;

    const candidates: ExistingEntityCandidate[] = [];
    for (const match of exactMatches) {
      const candidate = await fetchEntityCandidateById(match.id);
      if (candidate) candidates.push(candidate);
    }
    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const scoreDiff = scoreOrgCandidate(b) - scoreOrgCandidate(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.id.localeCompare(b.id);
    });

    map.set(normalizedName, candidates[0].id);
  }

  return map;
}

type ExistingPaperState = {
  description: string | null;
  propertyIds: Set<string>;
  relationTargets: Map<string, Set<string>>;
};

export async function fetchExistingPaperState(entityId: string): Promise<ExistingPaperState> {
  const data = await gql(
    `query($id: UUID!) {
      entity(id: $id) {
        id
        description
      }
      values(filter: { entityId: { is: $id } }, first: 500) {
        propertyId
      }
      relations(filter: { fromEntityId: { is: $id } }, first: 500) {
        typeId
        toEntity {
          id
        }
      }
    }`,
    { id: entityId },
  );

  const propertyIds = new Set<string>(
    (data?.values ?? []).map((value: any) => value?.propertyId).filter(Boolean),
  );
  const relationTargets = new Map<string, Set<string>>();

  for (const rel of data?.relations ?? []) {
    const typeId = rel?.typeId;
    const toEntityId = rel?.toEntity?.id;
    if (!typeId || !toEntityId) continue;
    if (!relationTargets.has(typeId)) relationTargets.set(typeId, new Set<string>());
    relationTargets.get(typeId)!.add(toEntityId);
  }

  return {
    description: data?.entity?.description ?? null,
    propertyIds,
    relationTargets,
  };
}

// ─── Image upload ─────────────────────────────────────────────────────────────

function resolveImage(local: string | undefined): string | null {
  if (!local) return null;
  const imageRoots = Array.from(
    new Set(
      IMAGE_DIR_CANDIDATES
        .map((candidate) => path.resolve(candidate))
        .filter((candidate) => fs.existsSync(candidate)),
    ),
  );
  const candidates = [
    path.resolve(local),
    ...imageRoots.flatMap((root) => [
      path.join(root, path.basename(path.dirname(local)), path.basename(local)),
      path.join(root, path.basename(local)),
    ]),
  ];
  return candidates.find(fs.existsSync) ?? null;
}

export async function uploadImage(local: string | undefined, name: string, ops: Op[]): Promise<string | null> {
  const p = resolveImage(local);
  if (!p) return null;
  try {
    const buf  = fs.readFileSync(p);
    const mime = p.endsWith(".jpg") || p.endsWith(".jpeg") ? "image/jpeg" : "image/png";
    const { id, ops: imgOps } = await Graph.createImage({
      url: `data:${mime};base64,${buf.toString("base64")}`,
      name, network: NETWORK,
    });
    ops.push(...imgOps);
    return id;
  } catch (e) {
    console.warn(`    ⚠️  Image failed for "${name}": ${e}`);
    return null;
  }
}

// ─── Block helpers ────────────────────────────────────────────────────────────

export function addTextBlock(ops: Op[], parentId: string, content: string, lastPos: Record<string, string>) {
  const { id, ops: blockOps } = Graph.createEntity({
    types:  [TYPES.text_block],
    values: [{ property: PROPERTIES.markdown_content, type: "text", value: content }],
  });
  ops.push(...blockOps);
  const pos = Position.generateBetween(lastPos[parentId] ?? null, null);
  lastPos[parentId] = pos;
  ops.push(...Graph.createRelation({
    fromEntity: parentId, toEntity: id,
    type: PROPERTIES.blocks, position: pos,
  }).ops);
}

export function addCollectionBlock(
  ops: Op[], parentId: string, blockName: string,
  itemIds: string[], view: string, lastPos: Record<string, string>,
) {
  if (itemIds.length === 0) return;
  const { id, ops: dbOps } = Graph.createEntity({
    name:  blockName,
    types: [TYPES.data_block],
    relations: {
      [PROPERTIES.data_source_type]: { toEntity: COLLECTION_DATA_SOURCE },
      [PROPERTIES.collection_item]:  itemIds.map(toEntity => ({ toEntity })),
    },
  });
  ops.push(...dbOps);
  const pos = Position.generateBetween(lastPos[parentId] ?? null, null);
  lastPos[parentId] = pos;
  ops.push(...Graph.createRelation({
    fromEntity: parentId, toEntity: id,
    type: PROPERTIES.blocks, position: pos,
    entityRelations: { [PROPERTIES.view]: { toEntity: view } },
  }).ops);
}

// ─── Publish one batch ────────────────────────────────────────────────────────

export async function publishBatch(ops: Op[], label: string): Promise<void> {
  fs.mkdirSync("data_to_delete", { recursive: true });
  const filename = `bounty_${label.replace(/[^a-z0-9]/gi, "_")}.txt`;
  printOps(ops, "data_to_delete", filename);
  console.log(`\n★ [${label}]: ${ops.length} ops`);
  if (ops.length === 0) {
    console.log("  (skip empty batch)");
    return;
  }
  if (DRY_RUN) { console.log("  (dry run)"); return; }
  const tx = await publishOps(ops, label);
  console.log(`✅ tx: ${tx}`);
  await new Promise(r => setTimeout(r, 2000));
}

// ─── Build paper lookup maps ──────────────────────────────────────────────────

export function buildPaperLookups(
  relPaperPerson:  RelPaperPerson[],
  relPaperVenue:   RelPaperVenue[],
  relPaperDataset: RelPaperDataset[],
  relPaperTopic:   RelPaperTopic[],
  relPaperOrg:     RelPaperOrg[],
  relPaperTag:     RelPaperTag[],
  personIds:  Record<string, string>,
  venueIds:   Record<string, string>,
  datasetIds: Record<string, string>,
  topicIds:   Record<string, string>,
  orgIds:     Record<string, string>,
  tagIds:     Record<string, string>,
) {
  const paperAuthors:  Record<string, Array<{ geoId: string; order: number }>> = {};
  const paperVenueId:  Record<string, string>                                  = {};
  const paperDatasets: Record<string, Array<{ geoId: string; relation: string }>> = {};
  const paperTopics:   Record<string, Array<{ geoId: string; relation: string; topicKind: string }>> = {};
  const paperTags:     Record<string, string[]> = {};
  const paperOrgs:     Record<string, string[]>                                = {};

  for (const r of relPaperPerson) {
    const g = personIds[r.person_name]; if (!g) continue;
    if (!paperAuthors[r.paper_id]) paperAuthors[r.paper_id] = [];
    paperAuthors[r.paper_id].push({ geoId: g, order: r.order ?? 99 });
  }
  for (const key of Object.keys(paperAuthors)) paperAuthors[key].sort((a, b) => a.order - b.order);

  for (const r of relPaperVenue)   { const g = venueIds[r.venue_name];    if (g) paperVenueId[r.paper_id]  = g; }

  for (const r of relPaperDataset) {
    const g = datasetIds[r.dataset_name]; if (!g) continue;
    if (!paperDatasets[r.paper_id]) paperDatasets[r.paper_id] = [];
    paperDatasets[r.paper_id].push({ geoId: g, relation: r.relation });
  }
  for (const r of relPaperTopic) {
    const g = topicIds[r.topic_name]; if (!g) continue;
    if (!paperTopics[r.paper_id]) paperTopics[r.paper_id] = [];
    paperTopics[r.paper_id].push({ geoId: g, relation: r.relation, topicKind: r.topic_kind });
  }
  for (const r of relPaperTag) {
    const g = tagIds[r.tag_name]; if (!g) continue;
    if (!paperTags[r.paper_id]) paperTags[r.paper_id] = [];
    if (!paperTags[r.paper_id].includes(g)) paperTags[r.paper_id].push(g);
  }
  for (const r of relPaperOrg) {
    const g = orgIds[r.org_name]; if (!g) continue;
    if (!paperOrgs[r.paper_id]) paperOrgs[r.paper_id] = [];
    if (!paperOrgs[r.paper_id].includes(g)) paperOrgs[r.paper_id].push(g);
  }

  return { paperAuthors, paperVenueId, paperDatasets, paperTopics, paperTags, paperOrgs, venueIds };
}

function buildPaperScalarValues(paper: PaperData) {
  const values: any[] = [];
  if (paper.web_url) values.push({ property: SPACE_PROPS.web_url, type: "text", value: paper.web_url });
  if (paper.publication_date) values.push({ property: SPACE_PROPS.publication_date, type: "date", value: paper.publication_date });
  if (paper.arxiv_url) values.push({ property: SPACE_PROPS.arxiv_url, type: "text", value: paper.arxiv_url });
  if (paper.code_url) values.push({ property: SPACE_PROPS.code_url, type: "text", value: paper.code_url });
  if (paper.semantic_scholar_url) {
    values.push({ property: SPACE_PROPS.semantic_scholar_url, type: "text", value: paper.semantic_scholar_url });
  }
  if (paper.key_contribution) {
    values.push({ property: SPACE_PROPS.key_contribution, type: "text", value: paper.key_contribution });
  }
  if (typeof paper.citation_count === "number") {
    values.push({ property: SPACE_PROPS.citation_count, type: "integer", value: paper.citation_count });
  }
  return values;
}

function hasNonEmptyText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ─── Build ops for one paper ──────────────────────────────────────────────────

export async function buildPaperOps(
  paper: PaperData,
  lookups: ReturnType<typeof buildPaperLookups>,
): Promise<Op[]> {
  const ops: Op[] = [];
  const pid = paper.id;
  const { paperAuthors, paperVenueId, paperDatasets, paperTopics, paperTags, paperOrgs, venueIds } = lookups;

  // Topics and tags
  const topicRels: Array<{ toEntity: string }> = [];
  for (const entry of (paperTopics[pid] ?? [])) topicRels.push({ toEntity: entry.geoId });
  const tagRels = (paperTags[pid] ?? []).map((toEntity) => ({ toEntity }));

  // Values
  const values = buildPaperScalarValues(paper);

  const rels: Record<string, any> = {};
  if (topicRels.length) rels[SPACE_PROPS.related_topics] = topicRels;
  if (tagRels.length) rels[SPACE_PROPS.tags] = tagRels;

  const { id: geoId, ops: paperOps } = Graph.createEntity({
    name: paper.name, description: paper.description,
    types: [TYPES.paper], values, relations: rels,
  });
  ops.push(...paperOps);

  // Avatar image
  const imageId = await uploadImage(paper.image_avatar ?? undefined, `${paper.name} avatar`, ops);
  if (imageId) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId, toEntity: imageId,
      type: ContentIds.AVATAR_PROPERTY,
    }).ops);
  }

  // Cover image
  const coverId = await uploadImage(paper.image_cover ?? undefined, `${paper.name} cover`, ops);
  if (coverId) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId,
      toEntity: coverId,
      type: SPACE_PROPS.cover,
    }).ops);
  }

  // Authors
  const authors = (paperAuthors[pid] ?? []).map(a => a.geoId);
  for (const authorId of authors) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId,
      toEntity: authorId,
      type: SPACE_PROPS.authors,
    }).ops);
  }

  // Venue
  const venueGeoId = paperVenueId[pid];
  if (venueGeoId) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId,
      toEntity: venueGeoId,
      type: SPACE_PROPS.published_in,
    }).ops);
  }

  const peerReviewedByGeoId = paper.peer_reviewed_by ? venueIds[paper.peer_reviewed_by] : undefined;
  if (peerReviewedByGeoId) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId,
      toEntity: peerReviewedByGeoId,
      type: SPACE_PROPS.peer_reviewed_by,
    }).ops);
  }

  // Organizations
  const orgEntities = paperOrgs[pid] ?? [];
  if (orgEntities.length > 0) {
    for (const orgId of orgEntities) {
      ops.push(...Graph.createRelation({
        fromEntity: geoId,
        toEntity: orgId,
        type: SPACE_PROPS.related_projects,
      }).ops);
    }
  }

  return ops;
}

export async function buildExistingPaperAugmentOps(
  existingPaperId: string,
  paper: PaperData,
  lookups: ReturnType<typeof buildPaperLookups>,
): Promise<Op[]> {
  const ops: Op[] = [];
  const pid = paper.id;
  const { paperAuthors, paperVenueId, paperTopics, paperTags, paperOrgs, venueIds } = lookups;
  const existing = await fetchExistingPaperState(existingPaperId);

  const missingValues = buildPaperScalarValues(paper).filter(
    (value) => !existing.propertyIds.has(value.property),
  );
  const shouldSetDescription = hasNonEmptyText(paper.description) && !hasNonEmptyText(existing.description);

  if (shouldSetDescription || missingValues.length > 0) {
    const { ops: updateOps } = Graph.updateEntity({
      id: existingPaperId,
      description: shouldSetDescription ? paper.description ?? undefined : undefined,
      values: missingValues,
    });
    ops.push(...updateOps);
  }

  const ensureRelation = (relationType: string, toEntity: string | null | undefined) => {
    if (!toEntity) return;
    const existingTargets = existing.relationTargets.get(relationType);
    if (existingTargets?.has(toEntity)) return;
    ops.push(
      ...Graph.createRelation({
        fromEntity: existingPaperId,
        toEntity,
        type: relationType,
      }).ops,
    );
  };

  const hasAvatar = (existing.relationTargets.get(ContentIds.AVATAR_PROPERTY)?.size ?? 0) > 0;
  if (!hasAvatar) {
    const imageId = await uploadImage(paper.image_avatar ?? undefined, `${paper.name} avatar`, ops);
    ensureRelation(ContentIds.AVATAR_PROPERTY, imageId);
  }

  const hasCover = (existing.relationTargets.get(SPACE_PROPS.cover)?.size ?? 0) > 0;
  if (!hasCover) {
    const coverId = await uploadImage(paper.image_cover ?? undefined, `${paper.name} cover`, ops);
    ensureRelation(SPACE_PROPS.cover, coverId);
  }

  for (const author of paperAuthors[pid] ?? []) {
    ensureRelation(SPACE_PROPS.authors, author.geoId);
  }

  ensureRelation(SPACE_PROPS.published_in, paperVenueId[pid]);

  const peerReviewedByGeoId = paper.peer_reviewed_by ? venueIds[paper.peer_reviewed_by] : undefined;
  ensureRelation(SPACE_PROPS.peer_reviewed_by, peerReviewedByGeoId);

  for (const topic of paperTopics[pid] ?? []) {
    ensureRelation(SPACE_PROPS.related_topics, topic.geoId);
  }

  for (const tagId of paperTags[pid] ?? []) {
    ensureRelation(SPACE_PROPS.tags, tagId);
  }

  for (const orgId of paperOrgs[pid] ?? []) {
    ensureRelation(SPACE_PROPS.related_projects, orgId);
  }

  return ops;
}
