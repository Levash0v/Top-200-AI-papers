import dotenv from "dotenv";
import { ContentIds, Graph, type Op } from "@geoprotocol/geo-sdk";
import { gql, printOps, publishOps } from "./src/functions";
import {
  load,
  type ConceptData,
  type DatasetData,
  type DomainData,
  type EraData,
  type OrgData,
  type PaperData,
  type PersonData,
  type VenueData,
} from "./src/bounty_shared";
import { PROPERTIES, TYPES } from "./src/constants";

dotenv.config();

/**
 * Cleanup script for entities created by the Top200 pipeline (30a-30d).
 *
 * Unlike rollback-by-ops, this script finds entities in the CURRENT target space
 * by matching the dataset names used by the pipeline and limiting deletion to
 * entities that have a Name value written in the current space.
 *
 * This makes it resilient to:
 * - old publish IDs no longer matching the current live graph
 * - older paper entities created as Project instead of Paper
 *
 * Default mode is dry run.
 *
 * Usage:
 *   bun run 32_cleanup_top200_space.ts
 *   APPLY=true CONFIRM=DELETE_TOP200 bun run 32_cleanup_top200_space.ts
 *
 * Optional env:
 *   BATCH_SIZE=1200
 *   KEEP_MATCHED_PERSONS=true|false (default: false)
 */

type SpaceEntity = {
  id: string;
  name: string | null;
  typeIds?: string[];
};

type EntityLiveState = {
  exists: boolean;
  propertyIds: string[];
  relationIds: string[];
};

const SPACE_ID = process.env.DEMO_SPACE_ID;
const APPLY = (process.env.APPLY || "false").toLowerCase() === "true";
const CONFIRM = process.env.CONFIRM || "";
const BATCH_SIZE = Math.max(1, Number(process.env.BATCH_SIZE || 1200));
const KEEP_MATCHED_PERSONS =
  (process.env.KEEP_MATCHED_PERSONS || "false").toLowerCase() === "true";

function normalizeName(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function makeNameSet(items: Array<{ name: string }>): Set<string> {
  return new Set(items.map((item) => normalizeName(item.name)).filter(Boolean));
}

async function fetchNameOwnedEntityIds(): Promise<Set<string>> {
  const data = await gqlWithRetry(
    `query($spaceId: UUID!, $propertyId: UUID!) {
      values(
        first: 5000
        filter: {
          spaceId: { is: $spaceId }
          propertyId: { is: $propertyId }
        }
      ) {
        entityId
      }
    }`,
    { spaceId: SPACE_ID, propertyId: PROPERTIES.name },
  );

  return new Set<string>((data?.values || []).map((v: any) => v?.entityId).filter(Boolean));
}

async function fetchEntitiesByType(typeId: string): Promise<SpaceEntity[]> {
  const data = await gqlWithRetry(
    `query($spaceId: UUID!, $typeId: UUID!) {
      entities(
        spaceId: $spaceId
        typeId: $typeId
        first: 2000
        filter: { name: { isNull: false } }
      ) {
        id
        name
        typeIds
      }
    }`,
    { spaceId: SPACE_ID, typeId },
  );

  return (data?.entities || []) as SpaceEntity[];
}

async function fetchChildEntities(parentIds: string[]): Promise<SpaceEntity[]> {
  if (parentIds.length === 0) return [];

  const idsLiteral = parentIds.map((id) => `"${id}"`).join(", ");
  const data = await gqlWithRetry(`{
    relations(
      first: 5000
      filter: {
        fromEntityId: { in: [${idsLiteral}] }
      }
    ) {
      typeId
      toEntity {
        id
        name
        typeIds
      }
    }
  }`);

  const keepChildTypes = new Set([TYPES.text_block, TYPES.data_block, TYPES.image]);
  const out = new Map<string, SpaceEntity>();

  for (const rel of data?.relations || []) {
    const child = rel?.toEntity;
    if (!child?.id) continue;
    const typeIds: string[] = child.typeIds || [];
    const isChildType = typeIds.some((typeId) => keepChildTypes.has(typeId));
    const isSupportedRel =
      rel.typeId === PROPERTIES.blocks || rel.typeId === ContentIds.AVATAR_PROPERTY;
    if (isChildType && isSupportedRel) {
      out.set(child.id, child as SpaceEntity);
    }
  }

  return [...out.values()];
}

async function fetchEntityLiveState(entityId: string): Promise<EntityLiveState> {
  const data = await gqlWithRetry(
    `query($id:UUID!){
      entity(id:$id){ id }
      values(filter:{entityId:{is:$id}}, first:500){ propertyId }
      out: relations(filter:{fromEntityId:{is:$id}}, first:500){ id }
      inc: relations(filter:{toEntityId:{is:$id}}, first:500){ id }
    }`,
    { id: entityId },
  );

  const exists = Boolean(data?.entity?.id);
  const propertyIds = Array.from(
    new Set<string>((data?.values || []).map((v: any) => v?.propertyId).filter(Boolean)),
  );
  const relationIds = Array.from(
    new Set<string>([
      ...((data?.out || []).map((r: any) => r?.id)),
      ...((data?.inc || []).map((r: any) => r?.id)),
    ].filter(Boolean)),
  );
  return { exists, propertyIds, relationIds };
}

async function gqlWithRetry(query: string, variables?: Record<string, any>, retries = 4) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await gql(query, variables);
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || error);
      const retryable =
        message.includes("503") ||
        message.includes("502") ||
        message.includes("429") ||
        message.includes("timeout") ||
        message.includes("fetch");
      if (!retryable || attempt === retries) throw error;
      const delayMs = 1000 * (attempt + 1);
      console.warn(`  retry ${attempt + 1}/${retries} after error: ${message}`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function main() {
  if (!SPACE_ID) throw new Error("DEMO_SPACE_ID is required");

  console.log("=== Cleanup Top200 Space Data (30a-30d) ===");
  console.log("Space:", SPACE_ID);
  console.log("Mode:", APPLY ? "APPLY" : "DRY RUN");
  console.log("Batch size:", BATCH_SIZE);
  console.log("Keep matched persons:", KEEP_MATCHED_PERSONS);

  const eras = load<EraData>("eras.json");
  const domains = load<DomainData>("domains.json");
  const venues = load<VenueData>("venues.json");
  const datasets = load<DatasetData>("datasets.json");
  const concepts = load<ConceptData>("concepts.json");
  const orgs = load<OrgData>("organizations.json");
  const persons = load<PersonData>("persons.json");
  const papers = load<PaperData>("papers.json");

  const topicNames = new Set([
    ...makeNameSet(eras),
    ...makeNameSet(domains),
    ...makeNameSet(concepts),
  ]);
  const projectNames = new Set([
    ...makeNameSet(venues),
    ...makeNameSet(datasets),
    ...makeNameSet(orgs),
  ]);
  const personNames = makeNameSet(persons);
  const paperNames = makeNameSet(papers);

  console.log("\nFetching space-local named entities...");
  const nameOwnedEntityIds = await fetchNameOwnedEntityIds();
  console.log("  entities with Name value in this space:", nameOwnedEntityIds.size);

  console.log("\nFetching current entities by type...");
  const [topicEntities, projectEntities, personEntities, paperEntities] = await Promise.all([
    fetchEntitiesByType(TYPES.topic),
    fetchEntitiesByType(TYPES.project),
    fetchEntitiesByType(TYPES.person),
    fetchEntitiesByType(TYPES.paper),
  ]);
  console.log(`  topics:   ${topicEntities.length}`);
  console.log(`  projects: ${projectEntities.length}`);
  console.log(`  persons:  ${personEntities.length}`);
  console.log(`  papers:   ${paperEntities.length}`);

  const targets = new Map<string, SpaceEntity>();

  for (const entity of topicEntities) {
    if (!nameOwnedEntityIds.has(entity.id)) continue;
    if (topicNames.has(normalizeName(entity.name))) targets.set(entity.id, entity);
  }

  for (const entity of projectEntities) {
    if (!nameOwnedEntityIds.has(entity.id)) continue;
    const name = normalizeName(entity.name);
    if (projectNames.has(name) || paperNames.has(name)) targets.set(entity.id, entity);
  }

  for (const entity of paperEntities) {
    if (!nameOwnedEntityIds.has(entity.id)) continue;
    if (paperNames.has(normalizeName(entity.name))) targets.set(entity.id, entity);
  }

  if (!KEEP_MATCHED_PERSONS) {
    for (const entity of personEntities) {
      if (!nameOwnedEntityIds.has(entity.id)) continue;
      if (personNames.has(normalizeName(entity.name))) targets.set(entity.id, entity);
    }
  }

  const matchedPaperIds = [...targets.values()]
    .filter((entity) => {
      const name = normalizeName(entity.name);
      return paperNames.has(name) && (
        entity.typeIds?.includes(TYPES.paper) ||
        entity.typeIds?.includes(TYPES.project)
      );
    })
    .map((entity) => entity.id);

  console.log("\nMatched target entities:");
  console.log("  total matched by name + type + local Name value:", targets.size);
  console.log("  matched papers (Paper or legacy Project):", matchedPaperIds.length);

  console.log("\nFetching child blocks/images for matched papers...");
  const childEntities = await fetchChildEntities(matchedPaperIds);
  for (const child of childEntities) targets.set(child.id, child);
  console.log("  matched child entities:", childEntities.length);

  const targetIdsInDeleteOrder: string[] = [];
  for (const child of childEntities) targetIdsInDeleteOrder.push(child.id);
  for (const entityId of targets.keys()) {
    if (!targetIdsInDeleteOrder.includes(entityId)) targetIdsInDeleteOrder.push(entityId);
  }

  const relationIdsToDelete = new Set<string>();
  const cleanupOps: Op[] = [];
  let entitiesMissing = 0;
  let entitiesWithValues = 0;

  console.log("\nScanning live state of matched entities...");
  for (let i = 0; i < targetIdsInDeleteOrder.length; i++) {
    const entityId = targetIdsInDeleteOrder[i];
    if ((i + 1) % 50 === 0) {
      console.log(`  scanned: ${i + 1}/${targetIdsInDeleteOrder.length}`);
      await sleep(150);
    }

    const live = await fetchEntityLiveState(entityId);
    if (!live.exists) {
      entitiesMissing++;
      continue;
    }

    if (live.propertyIds.length > 0) {
      const { ops } = Graph.updateEntity({
        id: entityId,
        unset: live.propertyIds.map((property) => ({ property })),
      });
      cleanupOps.push(...ops);
      entitiesWithValues++;
    }

    for (const relationId of live.relationIds) relationIdsToDelete.add(relationId);
  }

  for (const relationId of relationIdsToDelete) {
    const { ops } = Graph.deleteRelation({ id: relationId });
    cleanupOps.push(...ops);
  }

  for (const entityId of [...targetIdsInDeleteOrder].reverse()) {
    const { ops } = Graph.deleteEntity({ id: entityId });
    cleanupOps.push(...ops);
  }

  console.log("\nCleanup plan:");
  console.log("  matched entities:", targets.size);
  console.log("  entities missing already:", entitiesMissing);
  console.log("  entities with live values unset:", entitiesWithValues);
  console.log("  relations to delete:", relationIdsToDelete.size);
  console.log("  entities to delete:", targetIdsInDeleteOrder.length);
  console.log("  total cleanup ops:", cleanupOps.length);

  printOps(cleanupOps, "data_to_delete", "top200_space_cleanup_ops.txt");
  console.log("Saved: data_to_delete/top200_space_cleanup_ops.txt");

  if (!APPLY) {
    console.log("\nDry run complete. To execute:");
    console.log("APPLY=true CONFIRM=DELETE_TOP200 bun run 32_cleanup_top200_space.ts");
    return;
  }

  if (CONFIRM !== "DELETE_TOP200") {
    throw new Error('Refusing to publish cleanup ops. Set CONFIRM=DELETE_TOP200.');
  }

  if (cleanupOps.length === 0) {
    console.log("No ops to publish.");
    return;
  }

  const batches = chunk(cleanupOps, BATCH_SIZE);
  console.log(`\nPublishing ${batches.length} batch(es)...`);

  for (let i = 0; i < batches.length; i++) {
    const part = i + 1;
    const ops = batches[i];
    console.log(`  batch ${part}/${batches.length}: ${ops.length} ops`);
    const tx = await publishOps(ops, `Top200 cleanup batch ${part}/${batches.length}`);
    console.log(`  tx: ${tx}`);
  }

  console.log("\nCleanup published successfully.");
}

main().catch((err) => {
  console.error("Error:", err?.message || err);
  process.exit(1);
});
