import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { Graph, type Op } from "@geoprotocol/geo-sdk";
import { gql, printOps, publishOps } from "./src/functions";
import { TYPES } from "./src/constants";

dotenv.config();

/**
 * Rollback for Top200 pipeline (30a-30d).
 *
 * This version lives alongside the publish_release pipeline and removes both:
 * - relations created by the Top200 layers
 * - entities created by the Top200 layers
 *
 * Default mode is dry run.
 *
 * Usage:
 *   bun run 31_rollback_top200.ts
 *   APPLY=true CONFIRM=ROLLBACK_TOP200 bun run 31_rollback_top200.ts
 *
 * Optional env:
 *   OPS_DIR=data_to_delete
 *   OPS_FILE_REGEX=^bounty_Bounty_Top200_AI_Papers_.*\\.txt$
 *   BATCH_SIZE=1200
 *   KEEP_CREATED_PERSONS=true|false (default: false)
 */

type LayerStats = {
  file: string;
  opCount: number;
  createdEntities: number;
  createdRelations: number;
};

type EntityLiveState = {
  exists: boolean;
  propertyIds: string[];
  relationIds: string[];
  typeIds: string[];
};

const SPACE_ID = process.env.DEMO_SPACE_ID;
const APPLY = (process.env.APPLY || "false").toLowerCase() === "true";
const CONFIRM = process.env.CONFIRM || "";
const OPS_DIR = process.env.OPS_DIR || "data_to_delete";
const OPS_FILE_REGEX = new RegExp(
  process.env.OPS_FILE_REGEX || "^bounty_Bounty_Top200_AI_Papers_.*\\.txt$",
);
const BATCH_SIZE = Math.max(1, Number(process.env.BATCH_SIZE || 1200));
const KEEP_CREATED_PERSONS =
  (process.env.KEEP_CREATED_PERSONS || "false").toLowerCase() === "true";

function loadOpsFile(absPath: string): any[] {
  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid ops file (array expected): ${absPath}`);
  }
  return parsed;
}

function findTop200OpsFiles(): string[] {
  const absDir = path.resolve(OPS_DIR);
  if (!fs.existsSync(absDir)) {
    throw new Error(`Ops dir not found: ${absDir}`);
  }
  return fs
    .readdirSync(absDir)
    .filter((f) => OPS_FILE_REGEX.test(f))
    .sort()
    .map((f) => path.join(absDir, f));
}

async function fetchEntityLiveState(entityId: string): Promise<EntityLiveState> {
  const data = await gql(
    `query($id:UUID!){
      entity(id:$id){ id typeIds }
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
  const typeIds = Array.isArray(data?.entity?.typeIds) ? data.entity.typeIds : [];
  return { exists, propertyIds, relationIds, typeIds };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  if (!SPACE_ID) throw new Error("DEMO_SPACE_ID is required");

  console.log("=== Top200 Rollback (30a-30d) ===");
  console.log("Space:", SPACE_ID);
  console.log("Mode:", APPLY ? "APPLY" : "DRY RUN");
  console.log("Ops dir:", path.resolve(OPS_DIR));
  console.log("Ops file regex:", OPS_FILE_REGEX.toString());
  console.log("Batch size:", BATCH_SIZE);
  console.log("Keep created persons:", KEEP_CREATED_PERSONS);

  const files = findTop200OpsFiles();
  if (files.length === 0) {
    throw new Error("No Top200 ops files found. Check OPS_DIR / OPS_FILE_REGEX.");
  }

  const createdEntityIds = new Set<string>();
  const createdRelationIds = new Set<string>();
  const layerStats: LayerStats[] = [];

  for (const absPath of files) {
    const ops = loadOpsFile(absPath);
    let eCount = 0;
    let rCount = 0;

    for (const op of ops) {
      if (op?.type === "createEntity" && typeof op?.id === "string") {
        createdEntityIds.add(op.id);
        eCount++;
      } else if (op?.type === "createRelation" && typeof op?.id === "string") {
        createdRelationIds.add(op.id);
        rCount++;
      }
    }

    layerStats.push({
      file: path.basename(absPath),
      opCount: ops.length,
      createdEntities: eCount,
      createdRelations: rCount,
    });
  }

  console.log("\nLayers detected:");
  for (const s of layerStats) {
    console.log(`- ${s.file}: ops=${s.opCount}, createEntity=${s.createdEntities}, createRelation=${s.createdRelations}`);
  }

  console.log("\nUnique IDs from layers:");
  console.log("  created entities:", createdEntityIds.size);
  console.log("  created relations:", createdRelationIds.size);

  const rollbackOps: Op[] = [];
  const relationIdsToDelete = new Set<string>(createdRelationIds);
  const entityIdsToDelete: string[] = [];

  let entitiesWithLiveValues = 0;
  let entitiesScanned = 0;
  let entitiesMissing = 0;
  let skippedPersons = 0;

  for (const entityId of createdEntityIds) {
    entitiesScanned++;
    if (entitiesScanned % 50 === 0) {
      console.log(`  scanned live state: ${entitiesScanned}/${createdEntityIds.size}`);
    }

    const live = await fetchEntityLiveState(entityId);
    if (!live.exists) {
      entitiesMissing++;
      continue;
    }

    const isPerson = live.typeIds.includes(TYPES.person);
    if (KEEP_CREATED_PERSONS && isPerson) {
      skippedPersons++;
      continue;
    }

    if (live.propertyIds.length > 0) {
      const { ops } = Graph.updateEntity({
        id: entityId,
        unset: live.propertyIds.map((property) => ({ property })),
      });
      rollbackOps.push(...ops);
      entitiesWithLiveValues++;
    }

    for (const relationId of live.relationIds) relationIdsToDelete.add(relationId);
    entityIdsToDelete.push(entityId);
  }

  for (const relationId of relationIdsToDelete) {
    const { ops } = Graph.deleteRelation({ id: relationId });
    rollbackOps.push(...ops);
  }

  for (const entityId of entityIdsToDelete.reverse()) {
    const { ops } = await Graph.deleteEntity({ id: entityId, spaceId: SPACE_ID });
    rollbackOps.push(...ops);
  }

  console.log("\nRollback plan:");
  console.log("  entities scanned:", entitiesScanned);
  console.log("  entities missing already:", entitiesMissing);
  console.log("  entities with live values unset:", entitiesWithLiveValues);
  console.log("  created persons preserved:", skippedPersons);
  console.log("  relations to delete:", relationIdsToDelete.size);
  console.log("  entities to delete:", entityIdsToDelete.length);
  console.log("  total rollback ops:", rollbackOps.length);

  if (!fs.existsSync(OPS_DIR)) fs.mkdirSync(OPS_DIR, { recursive: true });
  printOps(rollbackOps, OPS_DIR, "top200_rollback_ops.txt");
  console.log(`Saved: ${path.join(OPS_DIR, "top200_rollback_ops.txt")}`);

  if (!APPLY) {
    console.log("\nDry run complete. To execute:");
    console.log("APPLY=true CONFIRM=ROLLBACK_TOP200 bun run 31_rollback_top200.ts");
    return;
  }

  if (CONFIRM !== "ROLLBACK_TOP200") {
    throw new Error('Refusing to publish rollback ops. Set CONFIRM=ROLLBACK_TOP200.');
  }

  if (rollbackOps.length === 0) {
    console.log("No ops to publish.");
    return;
  }

  const batches = chunk(rollbackOps, BATCH_SIZE);
  console.log(`\nPublishing ${batches.length} batch(es)...`);

  for (let i = 0; i < batches.length; i++) {
    const part = i + 1;
    const ops = batches[i];
    console.log(`  batch ${part}/${batches.length}: ${ops.length} ops`);
    const tx = await publishOps(ops, `Top200 rollback batch ${part}/${batches.length}`);
    console.log(`  tx: ${tx}`);
  }

  console.log("\nRollback published successfully.");
}

main().catch((err) => {
  console.error("Error:", err?.message || err);
  process.exit(1);
});
