/**
 * 28_check_ai_space.ts
 * Checks what already exists in the AI space before publishing
 * Run: bun run 28_check_ai_space.ts
 */
import dotenv from "dotenv";
import { gql } from "./src/functions";
import { TYPES } from "./src/constants";
dotenv.config();

const AI_SPACE_ID = "41e851610e13a19441c4d980f2f2ce6b";

async function countType(typeId: string, label: string) {
  const data = await gql(`{
    entities(
      spaceId: "${AI_SPACE_ID}"
      typeId:  "${typeId}"
      first:   1000
      filter:  { name: { isNull: false } }
    ) { id name }
  }`);
  const list: any[] = data?.entities ?? [];
  console.log(`  ${label}: ${list.length}`);
  if (list.length > 0 && list.length <= 20) {
    for (const e of list) console.log(`    - ${e.name}`);
  } else if (list.length > 0) {
    for (const e of list.slice(0, 5)) console.log(`    - ${e.name}`);
    console.log(`    ... and ${list.length - 5} more`);
  }
  return list;
}

async function main() {
  console.log(`\nAI Space: ${AI_SPACE_ID}`);
  console.log("https://www.geobrowser.io/space/41e851610e13a19441c4d980f2f2ce6b\n");

  const projects = await countType(TYPES.project, "Project entities");
  const persons  = await countType(TYPES.person,  "Person entities");
  const topics   = await countType(TYPES.topic,   "Topic entities");

  console.log(`\nTotal: ${projects.length + persons.length + topics.length} entities`);
}

main().catch(console.error);
