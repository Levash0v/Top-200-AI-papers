/**
 * 30c_papers91-150.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Batches 9-12:
 *   Batch 9:  Bounty Top200 AI Papers | Papers 91-105
 *   Batch 10: Bounty Top200 AI Papers | Papers 106-120
 *   Batch 11: Bounty Top200 AI Papers | Papers 121-135
 *   Batch 12: Bounty Top200 AI Papers | Papers 136-150
 *
 * IMPORTANT: run this only after all 30b batches are approved.
 *
 * Run: bun run 30c_papers91-150.ts
 *      DRY_RUN=1 bun run 30c_papers91-150.ts
 */

import dotenv from "dotenv";
import { type Op } from "@geoprotocol/geo-sdk";
import {
  SPACE_ID, BOUNTY, DRY_RUN,
  load, fetchExistingMap, publishBatch, buildPaperLookups, buildPaperOps,
  type PaperData, type RelPaperPerson, type RelPaperVenue, type RelPaperDataset,
  type RelPaperConcept, type RelPaperOrg, type RelPaperEra, type RelPaperDomain,
  type EraData, type DomainData, type VenueData, type DatasetData,
  type ConceptData, type OrgData, type PersonData,
} from "./src/bounty_shared";
import { TYPES } from "./src/constants";

dotenv.config();

async function buildRegistries(
  eras: EraData[], domains: DomainData[], venues: VenueData[], datasets: DatasetData[],
  concepts: ConceptData[], orgs: OrgData[], persons: PersonData[],
) {
  console.log("Fetching current entity IDs from AI space...");
  const [existingProjects, existingDatasets, existingPersons, existingTopics] = await Promise.all([
    fetchExistingMap(TYPES.project),
    fetchExistingMap(TYPES.dataset),
    fetchExistingMap(TYPES.person),
    fetchExistingMap(TYPES.topic),
  ]);
  console.log(`  ${existingProjects.size} projects · ${existingDatasets.size} datasets · ${existingPersons.size} persons · ${existingTopics.size} topics\n`);

  const eraIds:     Record<string, string> = {};
  const domainIds:  Record<string, string> = {};
  const venueIds:   Record<string, string> = {};
  const datasetIds: Record<string, string> = {};
  const conceptIds: Record<string, string> = {};
  const orgIds:     Record<string, string> = {};
  const personIds:  Record<string, string> = {};

  for (const e of eras)     { const x = existingTopics.get(e.name.toLowerCase().trim());    if (x) eraIds[e.name]     = x; }
  for (const d of domains)  { const x = existingTopics.get(d.name.toLowerCase().trim());    if (x) domainIds[d.name]  = x; }
  for (const v of venues)   { const x = existingProjects.get(v.name.toLowerCase().trim());  if (x) venueIds[v.name]   = x; }
  for (const d of datasets) { const x = existingDatasets.get(d.name.toLowerCase().trim());  if (x) datasetIds[d.name] = x; }
  for (const c of concepts) { const x = existingTopics.get(c.name.toLowerCase().trim());    if (x) conceptIds[c.name] = x; }
  for (const o of orgs)     { const x = existingProjects.get(o.name.toLowerCase().trim());  if (x) orgIds[o.name]     = x; }
  for (const p of persons)  { const x = existingPersons.get(p.name.toLowerCase().trim());   if (x) personIds[p.name]  = x; }

  return { eraIds, domainIds, venueIds, datasetIds, conceptIds, orgIds, personIds };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30c — Papers 91-150 (batches 9-12)                        ║");
  console.log(`║  Space: ${SPACE_ID.padEnd(54)}║`);
  console.log(`║  Mode:  ${(DRY_RUN ? "DRY RUN" : "LIVE · with images").padEnd(54)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

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

  const { eraIds, domainIds, venueIds, datasetIds, conceptIds, orgIds, personIds } =
    await buildRegistries(eras, domains, venues, datasets, concepts, orgs, persons);

  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperConcept, relPaperOrg, relPaperEra, relPaperDomain,
    personIds, venueIds, datasetIds, conceptIds, orgIds, eraIds, domainIds,
  );

  // BATCH 9 — Papers 91-105
  console.log("Building Papers 91-105...");
  const b9: Op[] = [];
  for (const paper of papers.slice(90, 105)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b9.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b9, `${BOUNTY} | Papers 91-105`);

  // BATCH 10 — Papers 106-120
  console.log("\nBuilding Papers 106-120...");
  const b10: Op[] = [];
  for (const paper of papers.slice(105, 120)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b10.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b10, `${BOUNTY} | Papers 106-120`);

  // BATCH 11 — Papers 121-135
  console.log("\nBuilding Papers 121-135...");
  const b11: Op[] = [];
  for (const paper of papers.slice(120, 135)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b11.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b11, `${BOUNTY} | Papers 121-135`);

  // BATCH 12 — Papers 136-150
  console.log("\nBuilding Papers 136-150...");
  const b12: Op[] = [];
  for (const paper of papers.slice(135, 150)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b12.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b12, `${BOUNTY} | Papers 136-150`);

  console.log("\n✅ 30c complete — 4 batches published");
  console.log("   Next: bun run 30d_papers151-202.ts");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
