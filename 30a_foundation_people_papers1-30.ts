/**
 * 30a_foundation_people_papers1-30.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Batches 1-4:
 *   Batch 1: Bounty Top200 AI Papers | Foundation
 *   Batch 2: Bounty Top200 AI Papers | People
 *   Batch 3: Bounty Top200 AI Papers | Papers 1-15
 *   Batch 4: Bounty Top200 AI Papers | Papers 16-30
 *
 * Run: bun run 30a_foundation_people_papers1-30.ts
 *      DRY_RUN=1 bun run 30a_foundation_people_papers1-30.ts
 */

import dotenv from "dotenv";
import { Graph, type Op } from "@geoprotocol/geo-sdk";
import {
  SPACE_ID, BOUNTY, DRY_RUN,
  load, fetchExistingMap, publishBatch, buildPaperLookups, buildPaperOps, normalizeEntityName,
  type EraData, type DomainData, type VenueData, type DatasetData,
  type ConceptData, type OrgData, type PersonData, type PaperData,
  type RelPaperPerson, type RelPaperVenue, type RelPaperDataset,
  type RelPaperConcept, type RelPaperOrg, type RelPaperEra, type RelPaperDomain,
} from "./src/bounty_shared";
import { TYPES, PROPERTIES } from "./src/constants";

dotenv.config();

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30a — Foundation + People + Papers 1-30                    ║");
  console.log(`║  Space: ${SPACE_ID.padEnd(54)}║`);
  console.log(`║  Mode:  ${(DRY_RUN ? "DRY RUN" : "LIVE · with images").padEnd(54)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── Load data ──────────────────────────────────────────────────────────────
  const eras        = load<EraData>       ("eras.json");
  const domains     = load<DomainData>    ("domains.json");
  const venues      = load<VenueData>     ("venues.json");
  const datasets    = load<DatasetData>   ("datasets.json");
  const concepts    = load<ConceptData>   ("concepts.json");
  const orgs        = load<OrgData>       ("organizations.json");
  const persons     = load<PersonData>    ("persons.json");
  const papers      = load<PaperData>     ("papers.json");
  const relPaperPerson  = load<RelPaperPerson> ("rel_paper_person.json");
  const relPaperVenue   = load<RelPaperVenue>  ("rel_paper_venue.json");
  const relPaperDataset = load<RelPaperDataset>("rel_paper_dataset.json");
  const relPaperConcept = load<RelPaperConcept>("rel_paper_concept.json");
  const relPaperOrg     = load<RelPaperOrg>    ("rel_paper_org.json");
  const relPaperEra     = load<RelPaperEra>    ("rel_paper_era.json");
  const relPaperDomain  = load<RelPaperDomain> ("rel_paper_domain.json");

  // ── Fetch existing entities for deduplication ──────────────────────────────
  console.log("Fetching existing entities from AI space...");
  const [existingProjects, existingDatasets, existingPersons, existingTopics, existingPapers] = await Promise.all([
    fetchExistingMap(TYPES.project),
    fetchExistingMap(TYPES.dataset),
    fetchExistingMap(TYPES.person),
    fetchExistingMap(TYPES.topic),
    fetchExistingMap(TYPES.paper),
  ]);
  console.log(`  ${existingProjects.size} projects · ${existingDatasets.size} datasets · ${existingPersons.size} persons · ${existingTopics.size} topics · ${existingPapers.size} papers\n`);

  // ── ID registries ──────────────────────────────────────────────────────────
  const eraIds:     Record<string, string> = {};
  const domainIds:  Record<string, string> = {};
  const venueIds:   Record<string, string> = {};
  const datasetIds: Record<string, string> = {};
  const conceptIds: Record<string, string> = {};
  const orgIds:     Record<string, string> = {};
  const personIds:  Record<string, string> = {};

  // Pre-populate with existing
  for (const e of eras)     { const x = existingTopics.get(e.name.toLowerCase().trim());    if (x) eraIds[e.name]     = x; }
  for (const d of domains)  { const x = existingTopics.get(d.name.toLowerCase().trim());    if (x) domainIds[d.name]  = x; }
  for (const o of orgs)     { const x = existingProjects.get(o.name.toLowerCase().trim());  if (x) orgIds[o.name]     = x; }
  for (const p of persons)  { const x = existingPersons.get(p.name.toLowerCase().trim());   if (x) personIds[p.name]  = x; }
  for (const c of concepts) { const x = existingTopics.get(c.name.toLowerCase().trim());    if (x) conceptIds[c.name] = x; }
  for (const v of venues)   { const x = existingProjects.get(v.name.toLowerCase().trim());  if (x) venueIds[v.name]   = x; }
  for (const d of datasets) { const x = existingDatasets.get(d.name.toLowerCase().trim());  if (x) datasetIds[d.name] = x; }

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 1 — Foundation
  // ════════════════════════════════════════════════════════════════════════════
  const b1: Op[] = [];

  for (const era of eras) {
    if (eraIds[era.name]) continue;
    const desc = era.years ? `${era.description} (${era.years})` : era.description;
    const { id, ops } = Graph.createEntity({ name: era.name, description: desc, types: [TYPES.topic] });
    eraIds[era.name] = id; b1.push(...ops);
  }
  for (const domain of domains) {
    if (domainIds[domain.name]) continue;
    const { id, ops } = Graph.createEntity({ name: domain.name, description: domain.description, types: [TYPES.topic] });
    domainIds[domain.name] = id; b1.push(...ops);
  }
  for (const venue of venues) {
    if (venueIds[venue.name]) continue;
    const desc = [venue.description, venue.type ? `Type: ${venue.type}` : null,
                  venue.since ? `Est. ${venue.since}` : null].filter(Boolean).join(" · ");
    const values: any[] = [];
    if (venue.web_url) values.push({ property: PROPERTIES.web_url, type: "text", value: venue.web_url });
    if (venue.since)   values.push({ property: PROPERTIES.date_founded, type: "date", value: `${venue.since}-01-01` });
    const { id, ops } = Graph.createEntity({ name: venue.name, description: desc, types: [TYPES.project], values });
    venueIds[venue.name] = id; b1.push(...ops);
  }
  for (const ds of datasets) {
    if (datasetIds[ds.name]) continue;
    const desc = [ds.description, ds.size ? `Size: ${ds.size}` : null, ds.year ? `Year: ${ds.year}` : null].filter(Boolean).join(" · ");
    const values: any[] = [];
    if (ds.web_url) values.push({ property: PROPERTIES.web_url, type: "text", value: ds.web_url });
    const { id, ops } = Graph.createEntity({ name: ds.name, description: desc, types: [TYPES.dataset], values });
    datasetIds[ds.name] = id; b1.push(...ops);
  }
  for (const concept of concepts) {
    if (conceptIds[concept.name]) continue;
    const { id, ops } = Graph.createEntity({ name: concept.name, description: concept.description, types: [TYPES.topic] });
    conceptIds[concept.name] = id; b1.push(...ops);
  }
  for (const org of orgs) {
    if (orgIds[org.name]) continue;
    const desc = [org.type, org.country].filter(Boolean).join(", ") || "Organization";
    const values: any[] = [];
    if (org.web_url) values.push({ property: PROPERTIES.web_url, type: "text", value: org.web_url });
    const { id, ops } = Graph.createEntity({ name: org.name, description: desc, types: [TYPES.project], values });
    orgIds[org.name] = id; b1.push(...ops);
  }

  await publishBatch(b1, `${BOUNTY} | Foundation`);

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 2 — People (only new ones)
  // ════════════════════════════════════════════════════════════════════════════
  const newPersons = persons.filter(p => !personIds[p.name]);
  console.log(`\nPeople: ${Object.keys(personIds).length} reuse existing · ${newPersons.length} new to create`);

  const b2: Op[] = [];
  for (const person of newPersons) {
    const values: any[] = [];
    if (person.web_url) values.push({ property: PROPERTIES.web_url, type: "text", value: person.web_url });
    const { id, ops } = Graph.createEntity({
      name: person.name, description: person.description,
      types: [TYPES.person], values,
    });
    personIds[person.name] = id; b2.push(...ops);
  }

  await publishBatch(b2, `${BOUNTY} | People`);

  // ── Build lookups ──────────────────────────────────────────────────────────
  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperConcept, relPaperOrg, relPaperEra, relPaperDomain,
    personIds, venueIds, datasetIds, conceptIds, orgIds, eraIds, domainIds,
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 3 — Papers 1-15
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\nBuilding Papers 1-15...");
  const b3: Op[] = [];
  for (const paper of papers.slice(0, 15)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b3.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b3, `${BOUNTY} | Papers 1-15`);

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 4 — Papers 16-30
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\nBuilding Papers 16-30...");
  const b4: Op[] = [];
  for (const paper of papers.slice(15, 30)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b4.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b4, `${BOUNTY} | Papers 16-30`);

  console.log("\n✅ 30a complete — 4 batches published");
  console.log("   Next: bun run 30b_papers31-90.ts");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
