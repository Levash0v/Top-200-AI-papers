# Org Reuse Map — 2026-03-26

Purpose:

- define the current safe reuse policy for org-like entities in the AI space
- separate exact reuse from cases that still need curator review
- prepare the ground for a name-first org reuse layer in the publish pipeline

AI space:

- `41e851610e13a19441c4d980f2f2ce6b`

Curator policy currently in force:

- if the same org-like entity already exists in the AI space, prefer reuse over create
- do not automatically collapse nearby brand-family entities into one canonical parent
- exact reuse is preferred
- near-match reuse requires curator review

## 1. Safe exact reuse candidates

These are safe candidates for direct reuse when the source label matches the same entity.

- `Anthropic`
  - existing IDs found:
    - `150eb37e739346abb1021f3c291e54cc`
    - `1e1227508bf34f9eab9aecfcea202a97`
    - `2df2f1036070437f973f95381fa3436f`
    - `3ea66dea266241fa960c1ab391ac274d`
    - `3eb798b272be4a699d16dc31c31058a6`
  - note:
    - duplicate existing entities already appear to exist in the AI space
    - this needs internal selection of a preferred canonical ID before wiring into publish logic

- `Apple`
  - confirmed existing IDs:
    - `2e245be6d0e64770b387bb3bafb1d404`
    - `e7d0727de0f74ac19d5b88f027dd1fde`
  - note:
    - at least one `Apple` entity exists already; choose one canonical target before automation

- `Google Brain`
  - existing ID:
    - `143e615b074f4f10b4f850681edd9323`

- `OpenAI`
  - existing IDs found:
    - `256574a8c2d342f78f87fd2d805487d1`
    - `424d12f46e5946d19e53831d5fc4bdce`
  - note:
    - duplicate existing entities already appear to exist in the AI space
    - choose one canonical ID before automation

- `Hugging Face`
  - confirmed existing ID:
    - `5e0fff5041e34f6fb21e40018f6cd443`

## 2. Near-match candidates requiring curator review

These are strong reuse candidates, but not exact-label equivalents in all cases.

- `Amazon Web Services`
  - likely candidates:
    - `4d3e66a270db454d8b76acb657880efa` -> `Amazon Web Services (AWS)`
    - `0c1e3541fd7e4515ab8e66232c234922` -> `Amazon`
  - curator question:
    - should source `Amazon Web Services` map to `Amazon Web Services (AWS)` or to `Amazon`?

- `NVIDIA Research`
  - likely candidate:
    - `4343e615ec254e788c4730efd8d5c11c` -> `NVIDIA`
  - curator question:
    - should source `NVIDIA Research` reuse `NVIDIA`, or remain separate until a dedicated `NVIDIA Research` entity exists?

- `University of Montreal (Mila)`
  - likely candidate:
    - `42cb1fe22fdf426f8c9d95b0e9924288` -> `MILA`
  - curator question:
    - should this source row map to `MILA`, or should the university/lab distinction be preserved?

## 3. Keep separate unless explicitly merged

These are related families, but should not be automatically collapsed into one entity.

- `Google Brain`
- `Google DeepMind`
- `Google Research`

Operational reading:

- reuse `Google Brain` if source is `Google Brain`
- do not automatically map `Google DeepMind` to `Google Brain`
- do not automatically map `Google Research` to `Google Brain`

## 4. Source rows still unresolved

These org-like rows currently do not have confirmed exact canonical reuse targets in this first pass:

- `Amazon Web Services`
- `Carnegie Mellon University`
- `Columbia University`
- `DAIR Institute`
- `Georgia Tech`
- `Google DeepMind`
- `Google Research`
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

## 5. Existing type noise found in AI space

The existing entities are reusable, but their current type assignment is inconsistent.

Examples:

- `Google Brain` -> `Company`
- `Hugging Face` -> `Project`
- `Amazon` -> `Project`
- `Amazon Web Services (AWS)` -> `Project`, `Provider`
- `MILA` -> `Company`
- `NVIDIA` -> `Project`, `Company`

Additional noise:

- `Apple` was found under a `Data block` type in one lookup
- `Anthropic` was found under a `Data block` type in one lookup
- one `OpenAI` entity had no type attached

Conclusion:

- type alone is not a safe filter for org reuse
- org reuse should be based primarily on existing canonical entity identity, not only on the current type bucket

## 6. Recommended next implementation step

Build an org reuse layer with two buckets:

- `exact_reuse_map`
  - exact source label -> canonical existing entity ID

- `manual_review_map`
  - source label -> list of plausible existing candidates

Then wire the publish flow so that:

- exact matches reuse existing AI-space entities
- unresolved rows still fall back to current create logic until curator decisions are finalized
