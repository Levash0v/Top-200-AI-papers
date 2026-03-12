/**
 * 30b_papers31-90.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Batches 5-8:
 *   Batch 5: Bounty Top200 AI Papers | Papers 31-45
 *   Batch 6: Bounty Top200 AI Papers | Papers 46-60
 *   Batch 7: Bounty Top200 AI Papers | Papers 61-75
 *   Batch 8: Bounty Top200 AI Papers | Papers 76-90
 *
 * IMPORTANT: run this only after all 30a batches are approved.
 *
 * Run: bun run 30b_papers31-90.ts
 *      DRY_RUN=1 bun run 30b_papers31-90.ts
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

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30b — Papers 31-90 (batches 5-8)                          ║");
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

  // ── Fetch ALL current entities from space (after 30a is approved) ──────────
  console.log("Fetching current entity IDs from AI space (after 30a approval)...");
  const [existingProjects, existingDatasets, existingPersons, existingTopics] = await Promise.all([
    fetchExistingMap(TYPES.project),
    fetchExistingMap(TYPES.dataset),
    fetchExistingMap(TYPES.person),
    fetchExistingMap(TYPES.topic),
  ]);
  console.log(`  ${existingProjects.size} projects · ${existingDatasets.size} datasets · ${existingPersons.size} persons · ${existingTopics.size} topics\n`);

  // ── Rebuild ID registries from space ──────────────────────────────────────
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

  const matched = {
    eras: Object.keys(eraIds).length, domains: Object.keys(domainIds).length,
    venues: Object.keys(venueIds).length, datasets: Object.keys(datasetIds).length,
    concepts: Object.keys(conceptIds).length, orgs: Object.keys(orgIds).length,
    persons: Object.keys(personIds).length,
  };
  console.log(`Matched from space: ${JSON.stringify(matched)}\n`);

  // ── Build lookups ──────────────────────────────────────────────────────────
  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperConcept, relPaperOrg, relPaperEra, relPaperDomain,
    personIds, venueIds, datasetIds, conceptIds, orgIds, eraIds, domainIds,
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 5 — Papers 31-45
  // ════════════════════════════════════════════════════════════════════════════
  console.log("Building Papers 31-45...");
  const b5: Op[] = [];
  for (const paper of papers.slice(30, 45)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b5.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b5, `${BOUNTY} | Papers 31-45`);

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 6 — Papers 46-60
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\nBuilding Papers 46-60...");
  const b6: Op[] = [];
  for (const paper of papers.slice(45, 60)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b6.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b6, `${BOUNTY} | Papers 46-60`);

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 7 — Papers 61-75
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\nBuilding Papers 61-75...");
  const b7: Op[] = [];
  for (const paper of papers.slice(60, 75)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b7.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b7, `${BOUNTY} | Papers 61-75`);

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 8 — Papers 76-90
  // ════════════════════════════════════════════════════════════════════════════
  console.log("\nBuilding Papers 76-90...");
  const b8: Op[] = [];
  for (const paper of papers.slice(75, 90)) {
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b8.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b8, `${BOUNTY} | Papers 76-90`);

  console.log("\n✅ 30b complete — 4 batches published");
  console.log("   Next: bun run 30c_papers91-150.ts");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
