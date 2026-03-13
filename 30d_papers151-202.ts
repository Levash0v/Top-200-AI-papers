/**
 * 30d_papers151-202.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Batches 13-16:
 *   Batch 13: Bounty Top200 AI Papers | Papers 151-165
 *   Batch 14: Bounty Top200 AI Papers | Papers 166-180
 *   Batch 15: Bounty Top200 AI Papers | Papers 181-195
 *   Batch 16: Bounty Top200 AI Papers | Papers 196-202
 *
 * IMPORTANT: run this only after all 30c batches are approved.
 *
 * Run: bun run 30d_papers151-202.ts
 *      DRY_RUN=1 bun run 30d_papers151-202.ts
 */

import dotenv from "dotenv";
import { type Op } from "@geoprotocol/geo-sdk";
import {
  SPACE_ID, BOUNTY, DRY_RUN,
  load, fetchExistingMap, publishBatch, buildPaperLookups, buildPaperOps, normalizeEntityName,
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
  const [existingProjects, existingDatasets, existingPersons, existingTopics, existingPapers] = await Promise.all([
    fetchExistingMap(TYPES.project),
    fetchExistingMap(TYPES.dataset),
    fetchExistingMap(TYPES.person),
    fetchExistingMap(TYPES.topic),
    fetchExistingMap(TYPES.paper),
  ]);
  console.log(`  ${existingProjects.size} projects · ${existingDatasets.size} datasets · ${existingPersons.size} persons · ${existingTopics.size} topics · ${existingPapers.size} papers\n`);

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

  return { eraIds, domainIds, venueIds, datasetIds, conceptIds, orgIds, personIds, existingPapers };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30d — Papers 151-202 (batches 13-16) 🏁 Final script      ║");
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

  const { eraIds, domainIds, venueIds, datasetIds, conceptIds, orgIds, personIds, existingPapers } =
    await buildRegistries(eras, domains, venues, datasets, concepts, orgs, persons);

  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperConcept, relPaperOrg, relPaperEra, relPaperDomain,
    personIds, venueIds, datasetIds, conceptIds, orgIds, eraIds, domainIds,
  );

  // BATCH 13 — Papers 151-165
  console.log("Building Papers 151-165...");
  const b13: Op[] = [];
  for (const paper of papers.slice(150, 165)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b13.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b13, `${BOUNTY} | Papers 151-165`);

  // BATCH 14 — Papers 166-180
  console.log("\nBuilding Papers 166-180...");
  const b14: Op[] = [];
  for (const paper of papers.slice(165, 180)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b14.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b14, `${BOUNTY} | Papers 166-180`);

  // BATCH 15 — Papers 181-195
  console.log("\nBuilding Papers 181-195...");
  const b15: Op[] = [];
  for (const paper of papers.slice(180, 195)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b15.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b15, `${BOUNTY} | Papers 181-195`);

  // BATCH 16 — Papers 196-202 (final)
  console.log("\nBuilding Papers 196-202...");
  const b16: Op[] = [];
  for (const paper of papers.slice(195)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b16.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b16, `${BOUNTY} | Papers 196-202`);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🏁 ALL DONE! 202 papers published to AI space             ║");
  console.log("║  16 batches · 4 scripts complete                           ║");
  console.log(`║  https://geobrowser.io/space/${SPACE_ID.slice(0, 32)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
