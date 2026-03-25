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
  SPACE_ID, BOUNTY, DRY_RUN, PILOT_PAPER_ID, PILOT_PAPER_NAME,
  load, fetchExistingMap, fetchExistingMaps, publishBatch, buildPaperLookups, buildPaperOps, normalizeEntityName, filterPapersForPilot,
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
  const existingAnyVenue = await fetchExistingMaps([TYPES.project, TYPES.journal]);
  for (const v of venues)   { const x = existingAnyVenue.get(v.name.toLowerCase().trim());  if (x) venueIds[v.name]   = x; }
  for (const d of datasets) { const x = existingDatasets.get(d.name.toLowerCase().trim());  if (x) datasetIds[d.name] = x; }
  for (const o of orgs)     { const x = existingProjects.get(o.name.toLowerCase().trim());  if (x) orgIds[o.name]     = x; }
  for (const p of persons)  { const x = existingPersons.get(p.name.toLowerCase().trim());   if (x) personIds[p.name]  = x; }

  return { topicIds, tagIds, venueIds, datasetIds, orgIds, personIds, existingPapers };
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  30d — Papers 151-202 (batches 13-16) 🏁 Final script      ║");
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
