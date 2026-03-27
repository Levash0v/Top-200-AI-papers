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
  SPACE_ID, BOUNTY, DRY_RUN, PILOT_PAPER_ID, PILOT_PAPER_NAME,
  load, fetchExistingMap, fetchExistingMaps, fetchExistingExactOrgMap, publishBatch, buildPaperLookups, buildPaperOps, buildExistingPaperAugmentOps, normalizeEntityName, filterPapersForPilot,
  type PaperData, type RelPaperPerson, type RelPaperVenue, type RelPaperDataset,
  type RelPaperTopic, type RelPaperOrg, type RelPaperTag,
  type TopicData, type TagData, type VenueData, type DatasetData,
  type OrgData, type PersonData,
} from "./src/bounty_shared";
import { TYPES } from "./src/constants";

dotenv.config();

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30b — Papers 31-90 (batches 5-8)                          ║");
  console.log(`║  Space: ${SPACE_ID.padEnd(54)}║`);
  console.log(`║  Mode:  ${(DRY_RUN ? "DRY RUN" : "LIVE · with images").padEnd(54)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  if (PILOT_PAPER_ID || PILOT_PAPER_NAME) {
    console.log(`Pilot mode active: ${PILOT_PAPER_ID ?? PILOT_PAPER_NAME}\n`);
  }

  // ── Load data ──────────────────────────────────────────────────────────────
  const topics      = load<TopicData>     ("topics.json");
  const tags        = load<TagData>       ("tags.json");
  const conferenceVenues = load<VenueData>("venues_conference.json");
  const journalVenues    = load<VenueData>("venues_journal.json");
  const venues      = [...conferenceVenues, ...journalVenues];
  const datasets    = load<DatasetData>   ("datasets.json");
  const orgs        = load<OrgData>       ("organizations.json");
  const persons     = load<PersonData>    ("persons.json");
  const papers      = filterPapersForPilot(load<PaperData>("papers.json"));
  const relPaperPerson  = load<RelPaperPerson> ("rel_paper_person.json");
  const relPaperVenue   = load<RelPaperVenue>  ("rel_paper_venue.json");
  const relPaperDataset = load<RelPaperDataset>("rel_paper_dataset.json");
  const relPaperTopic   = load<RelPaperTopic>  ("rel_paper_topic.json");
  const relPaperOrg     = load<RelPaperOrg>    ("rel_paper_org.json");
  const relPaperTag     = load<RelPaperTag>    ("rel_paper_tag.json");

  // ── Fetch ALL current entities from space (after 30a is approved) ──────────
  console.log("Fetching current entity IDs from AI space (after 30a approval)...");
  const [existingProjects, existingJournals, existingDatasets, existingPersons, existingTopics, existingTags, existingPapers] = await Promise.all([
    fetchExistingMap(TYPES.project),
    fetchExistingMap(TYPES.journal),
    fetchExistingMap(TYPES.dataset),
    fetchExistingMap(TYPES.person),
    fetchExistingMap(TYPES.topic),
    fetchExistingMap(TYPES.tag),
    fetchExistingMap(TYPES.paper),
  ]);
  console.log(`  ${existingProjects.size} projects · ${existingJournals.size} journals · ${existingDatasets.size} datasets · ${existingPersons.size} persons · ${existingTopics.size} topics · ${existingTags.size} tags · ${existingPapers.size} papers\n`);

  // ── Rebuild ID registries from space ──────────────────────────────────────
  const topicIds:   Record<string, string> = {};
  const tagIds:     Record<string, string> = {};
  const venueIds:   Record<string, string> = {};
  const datasetIds: Record<string, string> = {};
  const orgIds:     Record<string, string> = {};
  const personIds:  Record<string, string> = {};

  for (const t of topics)   { const x = existingTopics.get(t.name.toLowerCase().trim());    if (x) topicIds[t.name]   = x; }
  for (const t of tags)     { const x = existingTags.get(t.name.toLowerCase().trim()) ?? existingTopics.get(t.name.toLowerCase().trim()); if (x) tagIds[t.name] = x; }
  const existingAnyVenue = await fetchExistingMaps([TYPES.event, TYPES.journal]);
  for (const v of venues)   { const x = existingAnyVenue.get(v.name.toLowerCase().trim());  if (x) venueIds[v.name]   = x; }
  for (const d of datasets) { const x = existingDatasets.get(d.name.toLowerCase().trim());  if (x) datasetIds[d.name] = x; }
  for (const o of orgs)     { const x = existingProjects.get(o.name.toLowerCase().trim());  if (x) orgIds[o.name]     = x; }
  for (const p of persons)  { const x = existingPersons.get(p.name.toLowerCase().trim());   if (x) personIds[p.name]  = x; }
  const unresolvedOrgNames = orgs.filter((o) => !orgIds[o.name]).map((o) => o.name);
  const exactExistingOrgs = await fetchExistingExactOrgMap(unresolvedOrgNames);
  for (const o of orgs) {
    if (orgIds[o.name]) continue;
    const x = exactExistingOrgs.get(normalizeEntityName(o.name));
    if (x) orgIds[o.name] = x;
  }

  const matched = {
    topics: Object.keys(topicIds).length, tags: Object.keys(tagIds).length,
    venues: Object.keys(venueIds).length, datasets: Object.keys(datasetIds).length,
    orgs: Object.keys(orgIds).length, persons: Object.keys(personIds).length,
  };
  console.log(`Matched from space: ${JSON.stringify(matched)}\n`);

  // ── Build lookups ──────────────────────────────────────────────────────────
  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperTopic, relPaperOrg, relPaperTag,
    personIds, venueIds, datasetIds, topicIds, orgIds, tagIds,
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  BATCH 5 — Papers 31-45
  // ════════════════════════════════════════════════════════════════════════════
  console.log("Building Papers 31-45...");
  const b5: Op[] = [];
  for (const paper of papers.slice(30, 45)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b5.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
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
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b6.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
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
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b7.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
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
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b8.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b8.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b8, `${BOUNTY} | Papers 76-90`);

  console.log("\n✅ 30b complete — 4 batches published");
  console.log("   Next: bun run 30c_papers91-150.ts");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
