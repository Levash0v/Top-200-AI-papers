# Top200 Engineering Report — 2026-03-25

## Scope

Today's work focused on the `Top200 AI papers` publication pipeline rewrite, with the goal of aligning export and publish logic to the ontology direction discussed with Armando.

The main target was:

- move toward ontology-aligned publication
- prepare a one-paper pilot publish path
- avoid pushing the full workbook / generated data into Git

## What Was Done

### 1. Source schema re-check

We re-validated the current source workbook and its structure.

Confirmed source workbook:

- `/Users/max/Documents/GitHub/geo/geo_tech_demo/Geo_papers_schema_v2_metrics.xlsx`

Confirmed key modeling implications:

- `Domain` -> `Topic`
- `Concept` -> `Topic`
- `Era` -> `Tag`
- `Anchor Type` -> `Tag`
- `Conference` -> venue entity
- `Journal` -> journal entity
- `Preprint` -> no venue entity; links only on paper

Additional important conclusion:

- `Key paper` is not a standalone column
- it is one of the values inside `Anchor Type`

## 2. Workbook V3 proposal

A derived ontology-aligned workbook was created:

- [Geo_papers_schema_v3_ontology_aligned.xlsx](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/Geo_papers_schema_v3_ontology_aligned.xlsx)

This workbook introduces:

- `Topics`
- `Tags`
- `Venues_Conference`
- `Venues_Journal`
- `Rel_Paper_Topic`
- `Rel_Paper_Tag`
- `Rel_Paper_Venue`

Supporting spec note:

- [workbook_v3_top200_ontology_spec_2026-03-25.md](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/workbook_v3_top200_ontology_spec_2026-03-25.md)

## 3. Ontology-aligned exporter from v2

A new exporter was written:

- [export_schema_to_json_ontology.py](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/export_schema_to_json_ontology.py)

This exporter reads the existing `v2_metrics.xlsx` workbook and writes a new ontology-aligned JSON bundle into:

- [geo_publish_v2_ontology](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/geo_publish_v2_ontology)

Generated files include:

- `papers.json`
- `persons.json`
- `organizations.json`
- `datasets.json`
- `topics.json`
- `tags.json`
- `venues_conference.json`
- `venues_journal.json`
- `rel_paper_person.json`
- `rel_paper_org.json`
- `rel_person_org.json`
- `rel_paper_dataset.json`
- `rel_paper_topic.json`
- `rel_paper_tag.json`
- `rel_paper_venue.json`

Exporter behavior:

- combines `Domains` and `Concepts` into `topics.json`
- combines `Eras` and `Anchor Type` into `tags.json`
- splits venues into conference vs journal buckets
- excludes preprints from venue entity publication

## 4. Publish pipeline rewrite

The publication pipeline was updated to consume the new ontology-aligned JSON layer instead of the older `geo_publish_v2` shape.

Updated files:

- [30a_foundation_people_papers1-30.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/30a_foundation_people_papers1-30.ts)
- [30b_papers31-90.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/30b_papers31-90.ts)
- [30c_papers91-150.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/30c_papers91-150.ts)
- [30d_papers151-202.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/30d_papers151-202.ts)
- [31_rollback_top200.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/31_rollback_top200.ts)
- [32_cleanup_top200_space.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/32_cleanup_top200_space.ts)
- [src/bounty_shared.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/src/bounty_shared.ts)
- [src/constants.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/src/constants.ts)

Main code-level changes:

- `DATA_DIR` now prefers `geo_publish_v2_ontology`
- topics/tags/venue split are understood by the shared loader
- publication code now consumes:
  - `topics.json`
  - `tags.json`
  - `venues_conference.json`
  - `venues_journal.json`
- `SPACE_PROPS.tags` is now used for paper tag relations
- `Journal` and `Tag` type IDs are env-ready

Env-driven type placeholders:

- `GEO_JOURNAL_TYPE_ID`
- `GEO_TAG_TYPE_ID`

These are already wired into:

- [src/constants.ts](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/src/constants.ts)

Follow-up update from Armando:

- `Journal`: `d3f2be5a7be2426b80cce890092e01fe`
- `Tag`: `e0fcc66c9e8643f480802469d8a1a93a`
- confirmation on existing papers:
  - `Exactly, you need to inspect the existing entity and add only missing typed properties and missing relations, while keeping the current reuse/no-republish rule.`

This means the publish pipeline is no longer blocked on unknown type IDs for these two entity classes.

## 5. One-paper pilot mode

A true pilot-paper mode was implemented.

New supported env vars:

- `PILOT_PAPER_ID`
- `PILOT_PAPER_NAME`

The first pass only filtered the `papers` list, which was insufficient because `30a` still created almost the full foundation/person graph.

That was fixed.

`30a` now narrows not only the paper list, but also direct dependencies of the selected paper:

- authors
- topics
- tags
- venue
- datasets
- organizations

This produces a real canonical one-paper pilot instead of:

- one paper plus almost the whole global foundation

## 6. Pilot paper selection

Chosen pilot paper:

- `PILOT_PAPER_ID=1512.03385`
- `PILOT_PAPER_NAME="Deep Residual Learning for Image Recognition"`

Reason:

- strong scalar field coverage
- clear venue
- authors/datasets/topics/tags present
- compact enough for debugging
- good diagnostic value without excessive relation noise

## 7. Dry-run result

Command used:

```bash
PILOT_PAPER_ID=1512.03385 DRY_RUN=1 bun run 30a_foundation_people_papers1-30.ts
```

Important result:

- `Foundation: 60 ops`
- `People: 0 new`
- target paper was recognized as already existing in the current space

This confirmed:

- pilot filtering is now working at dependency level
- dry-run path is stable
- entity reuse logic is functioning

## 8. Existing-entity reuse logic

The current code already checks the target space for existing entities and avoids recreating them when names match.

Implemented via:

- `fetchExistingMap(...)`
- `fetchExistingMaps(...)`

Current dedup behavior:

- dedup is name-based
- uses normalized lowercase trimmed names
- applies to topics, tags, venues, datasets, persons, papers

Important note:

This is implemented technically, but whether this reuse policy is semantically correct for the final pilot still needs confirmation from Armando.

Open question:

- should the pilot target a clean test space
- or should it reuse already existing entities in the current public space

## 9. GRC-20 / geo-sdk verification

We checked both:

- `geobrowser/grc-20`
- `geobrowser/geo-sdk`

Conclusion:

- neither repo provides the actual `Journal` type UUID we need
- they expose protocol / SDK-level building blocks, not the needed space-specific ontology IDs

Therefore:

- `GEO_JOURNAL_TYPE_ID` must come from Armando / Geo team
- `GEO_TAG_TYPE_ID` also likely needs confirmation unless tags are intentionally still modeled as `topic`

## 10. Git

A selective push was performed with publication-related code only.

Pushed files:

- `30a–30d`
- `31`
- `32`
- `src/bounty_shared.ts`
- `src/constants.ts`
- `export_schema_to_json_ontology.py`

Not pushed:

- workbook `.xlsx`
- generated JSON bundle
- unrelated graph/demo/event-monitor files

Commit:

- `14ca374`
- `Prepare Top200 publication pipeline for ontology-aligned pilot publish`

Remote push:

- `origin/main`

## 11. Current status

The pipeline is now in a good state for a one-paper pilot review.

What is ready:

- ontology-aligned export path
- ontology-aligned publish path
- pilot paper mode
- dry-run validation
- selective commit pushed to GitHub

What is still blocked externally:

- `Journal` type UUID
- possibly `Tag` type UUID
- clarification from Armando on whether the pilot should:
  - reuse existing entities in the current space
  - or run in a clean test/pilot space

## 12. Recommended next step

1. send Armando a short update
2. request:
   - `Journal` type UUID
   - `Tag` type UUID if separate
   - confirmation on entity reuse policy for the pilot
3. once confirmed:
   - run one true pilot publish
   - inspect the resulting paper entity
   - use that as the canonical review case before scaling
