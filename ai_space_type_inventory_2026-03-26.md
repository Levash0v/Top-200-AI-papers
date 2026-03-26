# AI Space Type Inventory — 2026-03-26

Space:
- `41e851610e13a19441c4d980f2f2ce6b`

Purpose:
- local reference for type IDs discoverable directly inside the AI space
- useful when a type is not obvious from the root Geo space alone
- useful for checking current publish mappings against real space-specific ontology

Query method:
- GraphQL query against `https://testnet-api.geobrowser.io/graphql`
- `entities(spaceId: "41e851610e13a19441c4d980f2f2ce6b", typeId: "e7d737c536764c609fa16aa64a8c90ad", first: 200) { id name }`

## Discovered type entities in the AI space

- `0c4babfb43893486af827341bbf32e09` — `Dataset`
- `1d2ba35d8bc8441b2edc40cd9413f7c7` — `Venue`
- `26a39673fcd3bdec524c479f145cc2de` — `Prompt`
- `3f19baf016867cded41fe3610f9668f0` — `Model capability`
- `522de6b3580b40e3afd02a5fb2512765` — `Knowledge`
- `52e68966a4f743d3a7ae6cca8f838514` — `Category`
- `6e754d32056a6071d034f589f2123d80` — `Model type`
- `8219995ce18d334e71e29d29b1f2940d` — `Safety approach`
- `9069cd7680cabc7b5e7aace5bc0da4d3` — `Agent`
- `a7f1e5c799a04089e8741f412f135f42` — `Benchmark`
- `b36042f0903e948cc4b95c6ae6d50a58` — `Training approach`
- `b4c581aee8e93e0f314371cb08f622de` — `Modality`
- `bdfa487660d4628c6a1660410f18262f` — `Model family`
- `c59690cfa5dbb2cf74fcd3638f421f39` — `Model architecture`
- `c7a4fc6d1afc53250a22d4209391dc79` — `Model`
- `d44415aeaff1218c4035fe9a3791aff5` — `Provider`
- `d564f61a6c096312647e7b50cd9baa96` — `Evaluation`
- `d71c01083d9e46b9929621ccf90e009f` — `Metric`
- `e0f5dc54e55df1de55c75f0b6287d254` — `Embedding`
- `e2c760136ad957841c16024410c6dfbc` — `Data license`
- `eef94b7cd99f4fccafeb59cbe1738add` — `Skill`
- `f3c1c8687bed9cb15800e5c8ff38033d` — `Lab`
- `fccf1fef23ba4c2aa4f5a650cf70a030` — `Benchmark limitation`

## Important implications for Top200

- The AI space does contain a local `Venue` type:
  - `1d2ba35d8bc8441b2edc40cd9413f7c7`
- The AI space also contains a local `Lab` type:
  - `f3c1c8687bed9cb15800e5c8ff38033d`

This matters because current Top200 publish code still uses legacy fallback mappings:
- `conference -> Project`
- `organization/lab -> Project`

So these local AI-space types are potential candidates for correcting the mapping.

## Important caveat

Armando later clarified that conference publication venues like:
- `NeurIPS`
- `ICCV`
- `ICLR`
- `FAccT`

should be treated as:
- `Event`
- `4d876b81787e41fcab5d075d4da66a3f`

That means:
- the AI space having a `Venue` type does not by itself prove that Top200 conferences should publish as `Venue`
- for conference publication entities, the latest direct instruction from Armando currently overrides the older working assumption

## Current practical interpretation

- `conference publication venue`:
  - latest Armando direction says `Event`
- `journal publication venue`:
  - `Journal`
- `organization / research lab`:
  - likely should not remain on `Project`
- `Venue` and `Lab` types in the AI space should still be kept in mind as likely useful for other entity classes or future cleanup
