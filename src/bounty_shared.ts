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

export const SPACE_ID   = "41e851610e13a19441c4d980f2f2ce6b";
function resolveFirstExistingDir(candidates: string[], label: string): string {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  throw new Error(
    `${label} directory not found. Checked: ${candidates.map(c => path.resolve(c)).join(", ")}`
  );
}

export const DATA_DIR   = resolveFirstExistingDir(["./geo_publish_v2", "../geo_publish_v2"], "Data");
export const IMAGES_DIR = resolveFirstExistingDir(["./paper_images_202", "../paper_images_202"], "Images");
export const DRY_RUN    = process.env.DRY_RUN === "1";
export const NETWORK    = "TESTNET" as const;
export const BOUNTY     = "Bounty Top200 AI Papers";

// ─── Types ───────────────────────────────────────────────────────────────────

export type EraData     = { id: string; name: string; description: string; years: string | null };
export type DomainData  = { id: string; name: string; description: string };
export type VenueData   = { id: string; name: string; short_name: string | null; type: string | null;
                            description: string | null; since: number | null; web_url: string | null };
export type DatasetData = { id: string; name: string; description: string; domain: string | null;
                            year: number | null; size: string | null; web_url: string | null };
export type ConceptData = { id: string; name: string; description: string };
export type OrgData     = { id: string; name: string; type: string | null; country: string | null; web_url: string | null };
export type PersonData  = { id: string; name: string; description: string; web_url: string | null };
export type PaperData   = { id: string; name: string; description: string;
                            web_url: string | null; date_founded: string | null;
                            domain: string | null; era: string | null; venue: string | null;
                            people: string[]; blocks: string[];
                            arxiv_url?: string | null; code_url?: string | null;
                            citation_count?: number | null; key_contribution?: string | null;
                            doi?: string | null; abstract?: string | null; anchor_type?: string | null;
                            avatar_local?: string; cover_local?: string };
export type RelPaperPerson  = { paper_id: string; person_name: string; role: string | null; order: number | null };
export type RelPaperVenue   = { paper_id: string; venue_name: string };
export type RelPaperDataset = { paper_id: string; dataset_name: string; relation: string };
export type RelPaperConcept = { paper_id: string; concept_name: string; relation: string };
export type RelPaperOrg     = { paper_id: string; org_name: string };
export type RelPaperEra     = { paper_id: string; era_name: string };
export type RelPaperDomain  = { paper_id: string; domain_name: string };

// ─── Load JSON ───────────────────────────────────────────────────────────────

export function load<T>(file: string): T[] {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) throw new Error(`Missing: ${p}\nRun: python3 export_schema_to_json.py`);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T[];
}

// ─── Fetch name→id map from space ────────────────────────────────────────────

export async function fetchExistingMap(typeId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const data = await gql(`{
    entities(
      spaceId: "${SPACE_ID}"
      typeId:  "${typeId}"
      first:   1000
      filter:  { name: { isNull: false } }
    ) { id name }
  }`);
  for (const e of data?.entities ?? []) {
    if (e.name) map.set(e.name.toLowerCase().trim(), e.id);
  }
  return map;
}

// ─── Image upload ─────────────────────────────────────────────────────────────

function resolveImage(local: string | undefined): string | null {
  if (!local) return null;
  const candidates = [
    path.resolve(local),
    path.join(IMAGES_DIR, path.basename(path.dirname(local)), path.basename(local)),
    path.join(IMAGES_DIR, path.basename(local)),
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
  relPaperConcept: RelPaperConcept[],
  relPaperOrg:     RelPaperOrg[],
  relPaperEra:     RelPaperEra[],
  relPaperDomain:  RelPaperDomain[],
  personIds:  Record<string, string>,
  venueIds:   Record<string, string>,
  datasetIds: Record<string, string>,
  conceptIds: Record<string, string>,
  orgIds:     Record<string, string>,
  eraIds:     Record<string, string>,
  domainIds:  Record<string, string>,
) {
  const paperAuthors:  Record<string, Array<{ geoId: string; order: number }>> = {};
  const paperVenueId:  Record<string, string>                                  = {};
  const paperDatasets: Record<string, Array<{ geoId: string; relation: string }>> = {};
  const paperConcepts: Record<string, Array<{ geoId: string; relation: string }>> = {};
  const paperOrgs:     Record<string, string[]>                                = {};
  const paperEraId:    Record<string, string>                                  = {};
  const paperDomainId: Record<string, string>                                  = {};

  for (const r of relPaperPerson) {
    const g = personIds[r.person_name]; if (!g) continue;
    if (!paperAuthors[r.paper_id]) paperAuthors[r.paper_id] = [];
    paperAuthors[r.paper_id].push({ geoId: g, order: r.order ?? 99 });
  }
  for (const key of Object.keys(paperAuthors)) paperAuthors[key].sort((a, b) => a.order - b.order);

  for (const r of relPaperVenue)   { const g = venueIds[r.venue_name];    if (g) paperVenueId[r.paper_id]  = g; }
  for (const r of relPaperEra)     { const g = eraIds[r.era_name];        if (g) paperEraId[r.paper_id]    = g; }
  for (const r of relPaperDomain)  { const g = domainIds[r.domain_name];  if (g) paperDomainId[r.paper_id] = g; }

  for (const r of relPaperDataset) {
    const g = datasetIds[r.dataset_name]; if (!g) continue;
    if (!paperDatasets[r.paper_id]) paperDatasets[r.paper_id] = [];
    paperDatasets[r.paper_id].push({ geoId: g, relation: r.relation });
  }
  for (const r of relPaperConcept) {
    const g = conceptIds[r.concept_name]; if (!g) continue;
    if (!paperConcepts[r.paper_id]) paperConcepts[r.paper_id] = [];
    paperConcepts[r.paper_id].push({ geoId: g, relation: r.relation });
  }
  for (const r of relPaperOrg) {
    const g = orgIds[r.org_name]; if (!g) continue;
    if (!paperOrgs[r.paper_id]) paperOrgs[r.paper_id] = [];
    if (!paperOrgs[r.paper_id].includes(g)) paperOrgs[r.paper_id].push(g);
  }

  return { paperAuthors, paperVenueId, paperDatasets, paperConcepts, paperOrgs, paperEraId, paperDomainId };
}

// ─── Build ops for one paper ──────────────────────────────────────────────────

export async function buildPaperOps(
  paper: PaperData,
  lookups: ReturnType<typeof buildPaperLookups>,
): Promise<Op[]> {
  const ops: Op[] = [];
  const lastPos: Record<string, string> = {};
  const pid = paper.id;
  const { paperAuthors, paperVenueId, paperDatasets, paperConcepts, paperOrgs, paperEraId, paperDomainId } = lookups;

  // Topics: domain + era
  const topicRels: Array<{ toEntity: string }> = [];
  if (paperDomainId[pid]) topicRels.push({ toEntity: paperDomainId[pid] });
  if (paperEraId[pid])    topicRels.push({ toEntity: paperEraId[pid] });

  // Values
  const values: any[] = [];
  if (paper.web_url)      values.push({ property: SPACE_PROPS.web_url,          type: "text", value: paper.web_url });
  if (paper.date_founded) values.push({ property: SPACE_PROPS.publication_date, type: "date", value: paper.date_founded });
  if (paper.arxiv_url)    values.push({ property: SPACE_PROPS.arxiv_url,        type: "text", value: paper.arxiv_url });
  if (paper.code_url)     values.push({ property: SPACE_PROPS.code_url,         type: "text", value: paper.code_url });
  if (paper.key_contribution) {
    values.push({ property: SPACE_PROPS.key_contribution, type: "text", value: paper.key_contribution });
  }
  if (typeof paper.citation_count === "number") {
    values.push({ property: SPACE_PROPS.citation_count, type: "integer", value: paper.citation_count });
  }

  const rels: Record<string, any> = {};
  if (topicRels.length) rels[SPACE_PROPS.related_topics] = topicRels;

  const { id: geoId, ops: paperOps } = Graph.createEntity({
    name: paper.name, description: paper.description,
    types: [TYPES.paper], values, relations: rels,
  });
  ops.push(...paperOps);

  // Text blocks
  for (const content of paper.blocks) addTextBlock(ops, geoId, content, lastPos);

  // Avatar image
  const imageId = await uploadImage(paper.avatar_local, `${paper.name} avatar`, ops);
  if (imageId) {
    ops.push(...Graph.createRelation({
      fromEntity: geoId, toEntity: imageId,
      type: ContentIds.AVATAR_PROPERTY,
    }).ops);
  }

  // Cover image
  const coverId = await uploadImage(paper.cover_local, `${paper.name} cover`, ops);
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
    addCollectionBlock(ops, geoId, "Published In", [venueGeoId], VIEWS.list, lastPos);
  }

  // Datasets grouped
  const dsEntries = paperDatasets[pid] ?? [];
  if (dsEntries.length > 0) {
    const groups: Record<string, string[]> = {};
    for (const { geoId: dsId, relation } of dsEntries) {
      if (!groups[relation]) groups[relation] = [];
      groups[relation].push(dsId);
    }
    const labelMap: Record<string, string> = {
      EVALUATES_ON: "Evaluated On", INTRODUCES: "Introduces Dataset", USES: "Uses Dataset",
    };
    for (const [rel, ids] of Object.entries(groups)) {
      addCollectionBlock(ops, geoId, labelMap[rel] ?? rel, ids, VIEWS.gallery, lastPos);
    }
  }

  // Concepts grouped
  const cptEntries = paperConcepts[pid] ?? [];
  if (cptEntries.length > 0) {
    const groups: Record<string, string[]> = {};
    for (const { geoId: cId, relation } of cptEntries) {
      if (!groups[relation]) groups[relation] = [];
      groups[relation].push(cId);
    }
    const labelMap: Record<string, string> = {
      INTRODUCES: "Introduces", USES: "Uses", RELATED_TO: "Related Concepts",
    };
    for (const [rel, ids] of Object.entries(groups)) {
      addCollectionBlock(ops, geoId, labelMap[rel] ?? rel, ids, VIEWS.bullets, lastPos);
    }
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
    addCollectionBlock(ops, geoId, "Institutions", orgEntities, VIEWS.list, lastPos);
  }

  return ops;
}
