# Organization Name Scan in AI Space — 2026-03-26

AI space:
- `41e851610e13a19441c4d980f2f2ce6b`

Goal:
- identify organization-like entities already present in the AI space
- prefer reuse-by-existing-entity over create-new when safe
- surface exact matches and likely near-matches before changing org mapping logic

Method used in this pass:
- extracted source organization names from `geo_publish_v2_ontology/organizations.json`
- scanned named entities from the AI space for offsets `0..1000`
- compared normalized names locally
- additionally confirmed specific user-provided entity IDs directly via GraphQL

Important limitation:
- the AI space scan in this note is a first pass over the first `1000` named entities plus targeted ID checks
- this is enough to prove reuse opportunities exist, but not yet a complete exhaustive inventory of all org-like names in the space

## Exact matches found

- `Anthropic`
  - `150eb37e739346abb1021f3c291e54cc`
  - `1e1227508bf34f9eab9aecfcea202a97`
  - `2df2f1036070437f973f95381fa3436f`
  - `3ea66dea266241fa960c1ab391ac274d`
  - `3eb798b272be4a699d16dc31c31058a6`

- `Apple`
  - `2e245be6d0e64770b387bb3bafb1d404`

- `Google Brain`
  - `143e615b074f4f10b4f850681edd9323`

- `OpenAI`
  - `256574a8c2d342f78f87fd2d805487d1`
  - `424d12f46e5946d19e53831d5fc4bdce`

## Direct ID confirmations

These were confirmed directly by entity ID in the AI space:

- `Hugging Face`
  - `5e0fff5041e34f6fb21e40018f6cd443`

- `Apple`
  - `e7d0727de0f74ac19d5b88f027dd1fde`

- `Amazon`
  - `0c1e3541fd7e4515ab8e66232c234922`

Note:
- the user referred to `0c1e3541fd7e4515ab8e66232c234922` as Amazon Web Services
- direct GraphQL lookup returned the name `Amazon`

## Likely near-matches worth manual review

- `Amazon Web Services`
  - likely existing match:
    - `4d3e66a270db454d8b76acb657880efa` -> `Amazon Web Services (AWS)`
  - broader parent-like entity also present:
    - `0c1e3541fd7e4515ab8e66232c234922` -> `Amazon`

- `Hugging Face`
  - direct ID-confirmed entity exists:
    - `5e0fff5041e34f6fb21e40018f6cd443` -> `Hugging Face`
  - scan over first `1000` named entities did not catch it, which means relevant org-like entities can sit deeper than the first scan window

- `University of Montreal (Mila)`
  - likely related existing entity:
    - `42cb1fe22fdf426f8c9d95b0e9924288` -> `MILA`

- `NVIDIA Research`
  - likely related existing entities:
    - `4343e615ec254e788c4730efd8d5c11c` -> `NVIDIA`
    - `1496531476cf4e25883cad61fc97716d` -> `NVIDIA`

## Source rows with no exact match in this first-pass scan

- `Amazon Web Services`
- `Carnegie Mellon University`
- `Columbia University`
- `DAIR Institute`
- `Georgia Tech`
- `Google DeepMind`
- `Google Research`
- `Hugging Face`
- `MIT`
- `Max Planck Institute`
- `McGill University`
- `Meta AI`
- `Microsoft Research`
- `NVIDIA Research`
- `Princeton University`
- `Stanford University`
- `UC Berkeley`
- `University of Amsterdam`
- `University of Cambridge`
- `University of Massachusetts Amherst`
- `University of Montreal (Mila)`
- `University of Oxford`
- `University of Toronto`
- `University of Washington`

Important nuance:
- `no exact match in first-pass scan` does not mean `does not exist in the AI space`
- `Hugging Face` already proved that exact org entities can exist outside the first `1000` named rows returned by this scan method

## Practical conclusion

There is already enough evidence that org reuse should not rely only on current type-bucket lookups such as `TYPES.project`.

Safer next-step direction:
- add a reuse layer for organizations based on exact name match in the AI space
- prefer existing entity IDs when exact matches are found
- keep near-matches like `Amazon Web Services (AWS)` / `Amazon`, `MILA`, and `NVIDIA` under manual review until a normalization rule is agreed

## Suggested next step

Build a dedicated org reuse map:
- `exact name -> existing entity id(s)`
- `likely alias / parent / shorthand -> review required`

This would let the publish pipeline:
- reuse `Apple`, `Hugging Face`, `OpenAI`, `Anthropic`, `Google Brain`, and similar entities immediately
- avoid creating duplicate org-like entities before we finalize the post-`Project` org type mapping
