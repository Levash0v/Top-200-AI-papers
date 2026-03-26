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
  SPACE_ID, BOUNTY, DRY_RUN, PILOT_PAPER_ID, PILOT_PAPER_NAME,
  load, fetchExistingMap, fetchExistingMaps, publishBatch, buildPaperLookups, buildPaperOps, buildExistingPaperAugmentOps, normalizeEntityName, filterPapersForPilot,
  type PaperData, type RelPaperPerson, type RelPaperVenue, type RelPaperDataset,
  type RelPaperTopic, type RelPaperOrg, type RelPaperTag,
  type TopicData, type TagData, type VenueData, type DatasetData,
  type OrgData, type PersonData,
} from "./src/bounty_shared";
import { TYPES } from "./src/constants";

dotenv.config();

async function buildRegistries(
  topics: TopicData[], tags: TagData[], venues: VenueData[], datasets: DatasetData[],
  orgs: OrgData[], persons: PersonData[],
) {
  console.log("Fetching current entity IDs from AI space...");
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

  return { topicIds, tagIds, venueIds, datasetIds, orgIds, personIds, existingPapers };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30c — Papers 91-150 (batches 9-12)                        ║");
  console.log(`║  Space: ${SPACE_ID.padEnd(54)}║`);
  console.log(`║  Mode:  ${(DRY_RUN ? "DRY RUN" : "LIVE · with images").padEnd(54)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  if (PILOT_PAPER_ID || PILOT_PAPER_NAME) {
    console.log(`Pilot mode active: ${PILOT_PAPER_ID ?? PILOT_PAPER_NAME}\n`);
  }

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

  const { topicIds, tagIds, venueIds, datasetIds, orgIds, personIds, existingPapers } =
    await buildRegistries(topics, tags, venues, datasets, orgs, persons);

  const lookups = buildPaperLookups(
    relPaperPerson, relPaperVenue, relPaperDataset,
    relPaperTopic, relPaperOrg, relPaperTag,
    personIds, venueIds, datasetIds, topicIds, orgIds, tagIds,
  );

  // BATCH 9 — Papers 91-105
  console.log("Building Papers 91-105...");
  const b9: Op[] = [];
  for (const paper of papers.slice(90, 105)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b9.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b9.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b9, `${BOUNTY} | Papers 91-105`);

  // BATCH 10 — Papers 106-120
  console.log("\nBuilding Papers 106-120...");
  const b10: Op[] = [];
  for (const paper of papers.slice(105, 120)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b10.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b10.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b10, `${BOUNTY} | Papers 106-120`);

  // BATCH 11 — Papers 121-135
  console.log("\nBuilding Papers 121-135...");
  const b11: Op[] = [];
  for (const paper of papers.slice(120, 135)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b11.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b11.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b11, `${BOUNTY} | Papers 121-135`);

  // BATCH 12 — Papers 136-150
  console.log("\nBuilding Papers 136-150...");
  const b12: Op[] = [];
  for (const paper of papers.slice(135, 150)) {
    const existingPaperId = existingPapers.get(normalizeEntityName(paper.name));
    if (existingPaperId) {
      console.log(`  ⏭️  ${paper.name.slice(0, 60)} (already exists: ${existingPaperId})`);
      b12.push(...await buildExistingPaperAugmentOps(existingPaperId, paper, lookups));
      continue;
    }
    console.log(`  📄 ${paper.name.slice(0, 60)}`);
    b12.push(...await buildPaperOps(paper, lookups));
  }
  await publishBatch(b12, `${BOUNTY} | Papers 136-150`);

  console.log("\n✅ 30c complete — 4 batches published");
  console.log("   Next: bun run 30d_papers151-202.ts");
}

main().catch(err => { console.error("\n❌ Fatal:", err); process.exit(1); });
