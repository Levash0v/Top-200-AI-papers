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

## 13. Curatorial policy update — org-like entities

Current curator decision for org-like entities:

- if the same entity already exists in the AI space, prefer reuse over create
- do not automatically collapse nearby brand-family entities into one canonical parent

This means names such as:

- `Google Brain`
- `Google DeepMind`
- `Google Research`

should be treated as separate entities unless there is an explicit decision to merge them.

Reason:

- they are related historically, but they are not the same label
- automatic collapse would hide meaning and make paper-to-org attribution less precise
- for this project, curator control is preferred over aggressive automatic normalization

Operational implication:

- reuse should apply when the matching entity itself already exists
- reuse should not be interpreted as permission to map neighboring entities to one another just because they belong to the same company family

Examples:

- reuse `Google Brain` if `Google Brain` already exists
- do not automatically map `Google DeepMind` to `Google Brain`
- do not automatically map `Google Research` to `Google Brain`

Next open implementation question:

- organization reuse should likely become name-first and AI-space-aware, instead of relying only on the current expected type bucket such as `Project`

Follow-up implementation status:

- a first-pass exact org reuse layer has now been added
- it reuses exact existing AI-space entities before creating new org-like entities
- this was confirmed in dry-run on:
  - `DistilBERT` -> `Hugging Face`
  - `Attention Is All You Need` -> `Google Brain`
- in both cases the foundation batch no longer created a duplicate org entity
- near-match merges such as `AWS -> Amazon`, `NVIDIA Research -> NVIDIA`, and `University of Montreal (Mila) -> MILA` are still intentionally excluded from automatic reuse

## 14. Venue normalization rule — hybrid and historical cases

Current venue normalization rule:

- do not automatically reinterpret a journal as an event just because its title contains words like `Proceedings`
- normalize hybrid strings only when the paper context clearly mixes two different publication layers

Applied example:

- `ACM Transactions on Graphics (SIGGRAPH)` was split into:
  - `Journal` -> `ACM Transactions on Graphics`
  - `Conference/Event` -> `SIGGRAPH 2023`

Reason:

- this separates journal publication from conference event context without contradiction
- it aligns with the current ontology direction:
  - `conference -> Event`
  - `journal -> Journal`

Counter-example:

- names such as `Proceedings of the Royal Society (London)` should not be auto-split or auto-reclassified only because `Proceedings` appears in the title
- historical journal-style titles require paper-level citation context before any normalization decision

Operational implication:

- hybrid venue cleanup should stay case-by-case
- no broad regex-based rewrite of `Proceedings`, `Transactions`, or similar journal title patterns should be applied without paper-specific evidence

## 15. Non-traditional publication cases

Not every Top200 item should be expected to have a normal journal/conference venue.

Some newer items are better understood as:

- technical reports
- web publications
- blog posts
- software releases
- repository-first releases
- documentation-first releases

Examples:

- `GPT (2018)` -> OpenAI technical report
- `GPT-2 (2019)` -> OpenAI technical report
- `YOLOv5 (2020)` -> GitHub repository / software release
- `ChatGPT (2022)` -> OpenAI web publication / blog post
- `YOLOv8 (2023)` -> documentation / software release

Reason:

- these are not standard journal-or-conference publication cases
- so missing `primary_venue_*` should not automatically be treated as a data-quality problem
- and missing `arXiv` should not automatically be treated as an anomaly either

Operational implication:

- venue completeness checks should distinguish between:
  - standard academic publication cases
  - non-traditional publication cases
- venue-normalization logic should not force every paper into `Journal` / `Conference` / `Preprint` when the source item is clearly a report, release, repo, or web publication

## 16. Current ontology and pipeline snapshot

What is already implemented and validated:

- `votingMode: "SLOW"` was added to DAO `proposeEdit(...)`, which unblocked live publication
- the one-paper live pilot succeeded for `Deep Residual Learning for Image Recognition`
- `conference -> Event` has been implemented and pushed
- empty `0 ops` batches are now skipped instead of creating empty proposals
- exact existing org reuse has been implemented and confirmed in dry-run on:
  - `DistilBERT` -> `Hugging Face`
  - `Attention Is All You Need` -> `Google Brain`

Current publication-layer understanding:

- `primary_venue_*` is the clean normalized primary publication layer in the source bundle
- `published_in` is the main publication relation used in Geo
- `Journal` is currently treated as a type
- `Conference` is currently treated as `Event` type
- AI-space `Venue` should not currently be used as a replacement for `published_in`

Reason:

- current AI-space `Venue` is treated as a physical/event-hosting venue concept, not as the journal/publication relation itself
- therefore it should not replace the publication model for Top200 papers

Current reading of `peer_reviewed_by`:

- it is not a clean conference-only field
- in the current source bundle it behaves as a mixed auxiliary venue-context layer
- sometimes it duplicates the primary venue using a fuller label
- sometimes it adds a real secondary event/review context
- sometimes it is the only available venue-like context when `primary_venue_*` is missing

Operational rule for now:

- use `peer_reviewed_by` only when it adds real structure or enrichment
- do not treat it as a mandatory second publication layer for every paper

Current org/affiliation understanding:

- paper -> org currently publishes through `related_projects`
- in practice this relation is carrying research affiliations, not generic “projects”
- the linked entities currently include:
  - research labs
  - universities
  - research organizations

Resolved ontology clarification from Armando:

- `journal -> Journal type`
  - examples: `Nature`, `Journal of Machine Learning Research`
- `conference -> Event type`
  - examples: `CVPR`, `NeurIPS`

Also explicitly clarified:

- do **not** use `Venue` as a property for Top200 publication modeling
- do **not** use `Venue` as a type for Top200 publication modeling
- do **not** switch org-like affiliation entities to `Research lab` property
- do **not** switch org-like affiliation entities to `Lab` type
- for org-like affiliations, stay on the current `Project` path

Operational consequence:

- `published_in` remains the publication relation
- `Journal` remains the target type for journal publications
- `Event` remains the target type for conference publications
- `Project` remains the current target path for paper -> organization / affiliation-style relations
- `Venue`, `Research lab`, and `Lab` are now out of scope for the current Top200 pipeline

This closes the earlier pending ambiguity around:

- `Venue` property vs `Venue` type
- `Research lab` property vs `Lab` type

## 17. Updated Top200 execution plan

What is already done:

- `conference -> Event` has been implemented and validated
- `journal -> Journal` is confirmed and already aligned
- empty batch proposals are skipped
- exact existing org reuse is implemented and validated
- hybrid venue cleanup for `TOG / SIGGRAPH` has been normalized
- one-paper pilot publish has already succeeded live

What remains as the current working plan:

1. keep the current publication model stable
   - `published_in -> Journal`
   - `conference -> Event`

2. keep paper -> organization links on the current `Project` path
   - do not remap to `Lab`
   - do not remap to `Research lab`

3. continue using exact existing-entity reuse before create
   - especially for org-like entities already present in the AI space

4. continue treating `peer_reviewed_by` as optional enrichment only
   - do not force it into a second universal publication layer

5. handle non-traditional publication cases separately
   - technical reports
   - web publications
   - repo / software releases
   - documentation-first releases

6. the next likely implementation step, if publication quality is the priority:
   - add a separate image pass for papers
   - because the successful missing-only pilot intentionally did not publish images

## 18. `peer_reviewed_by` venue backfill applied

A controlled data-only backfill was applied to:

- [papers.json](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/geo_publish_v2_ontology/papers.json)

Backup created:

- [papers.backup_2026-03-27_peer_review_backfill.json](/Users/max/Documents/GitHub/top200_publish_release_sync_repo/geo_publish_v2_ontology/papers.backup_2026-03-27_peer_review_backfill.json)

Scope of the patch:

- filled `primary_venue_name`
- filled `primary_venue_type`
- used existing `peer_reviewed_by` only as a controlled source for backfill
- did **not** modify:
  - `peer_reviewed_by`
  - relation JSON
  - publish code

Result:

- `57` papers received venue backfill
- `Tacotron 2` was reclassified as:
  - `is_preprint_only = true`
  - `primary_venue_*` left empty

Current counts after patch:

- `primary_venue_name` filled: `146`
- `peer_reviewed_by` filled: `114`
- `is_preprint_only = true`: `7`

Representative backfilled cases:

- `Programs with Common Sense`
  - `Mechanization of Thought Processes, Vol. I`
  - `Conference`
- `Steps Toward Artificial Intelligence`
  - `Proceedings of the IRE`
  - `Journal`
- `XGBoost: A Scalable Tree Boosting System`
  - `KDD`
  - `Conference`
- `LIME: Why Should I Trust You?`
  - `KDD`
  - `Conference`
- `A Simple Framework for Contrastive Learning of Visual Representations (SimCLR)`
  - `ICML`
  - `Conference`
- `Informer: Beyond Efficient Transformer for Long Sequence Forecasting`
  - `AAAI`
  - `Conference`
- `Emergent Abilities of Large Language Models`
  - `Transactions on Machine Learning Research`
  - `Journal`
- `DINOv2: Learning Robust Visual Features without Supervision`
  - `Transactions on Machine Learning Research`
  - `Journal`

Operational rule preserved:

- `peer_reviewed_by` remains an auxiliary field
- it was used here only as a source for safe venue normalization when `primary_venue_*` was missing
- it is still not treated as a mandatory second publication layer for all papers
