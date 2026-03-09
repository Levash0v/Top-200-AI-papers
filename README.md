# Top200 AI Papers Geo Publishing Pipeline

This folder is a standalone publish bundle extracted from the working branch.
It is intended for sharing/releasing the publication flow separately.

## What the pipeline does

The pipeline publishes the AI papers graph into a Geo space in 4 sequential scripts:

- `30a_foundation_people_papers1-30.ts`
  - creates foundation entities: eras, domains, venues, datasets, concepts, organizations
  - creates missing people entities
  - publishes papers 1-30
- `30b_papers31-90.ts` publishes papers 31-90
- `30c_papers91-150.ts` publishes papers 91-150
- `30d_papers151-202.ts` publishes the final papers batch

Supporting script:

- `28_check_ai_space.ts` checks current entity counts in the target AI space.

## Data used

The scripts read JSON files from `../geo_publish_v2/` (default path from `src/bounty_shared.ts`):

- entities: `eras.json`, `domains.json`, `venues.json`, `datasets.json`, `concepts.json`, `organizations.json`, `persons.json`, `papers.json`
- relations: `rel_paper_person.json`, `rel_paper_venue.json`, `rel_paper_dataset.json`, `rel_paper_concept.json`, `rel_paper_org.json`, `rel_paper_era.json`, `rel_paper_domain.json`
- images: `../paper_images_202/` (optional; papers still publish if an image is missing)

If your data lives elsewhere, update `DATA_DIR` and `IMAGES_DIR` in `src/bounty_shared.ts`.

## How publishing to Geo works

1. Each script builds Geo SDK operations (`ops`) for entities, relations, blocks, and images.
2. `publishBatch` writes ops snapshots to `data_to_delete/` for audit/debug.
3. In live mode, `publishOps` resolves space type (PERSONAL or DAO) and submits/proposes the edit on testnet.

## Dependencies

Install with Bun:

```bash
bun install
```

Main dependencies (from `package.json`):

- `@geoprotocol/geo-sdk`
- `dotenv`
- `viem`
- `typescript` (+ `@types/node`)

## Environment

Use `.env` (or `.env.example` as a template):

```env
DEMO_SPACE_ID=<target_space_id>
PK_SW=0x<private_key>
```

Optional:

```env
DRY_RUN=1
```

## Run order

```bash
bun run 28_check_ai_space.ts
bun run 30a_foundation_people_papers1-30.ts
bun run 30b_papers31-90.ts
bun run 30c_papers91-150.ts
bun run 30d_papers151-202.ts
```

## Notes

- Keep this bundle and your exploratory scripts separate.
- Existing root `README.md` in the project remains unchanged.
