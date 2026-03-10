import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { createPlayerImportTemplateWorkbook } from "../src/lib/admin/player-import-template.ts";

const workbook = createPlayerImportTemplateWorkbook();
const firstSheetName = workbook.SheetNames[0];
assert.equal(firstSheetName, "Players");

const firstSheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as string[][];

assert.deepEqual(rows[0], ["group", "region", "affiliation", "name", "hand"]);
assert.equal(rows[1]?.[3], "홍길동");
assert.equal(rows[2]?.[4], "left");

console.log("player-import template test passed");
