import * as XLSX from "xlsx";

const PLAYER_IMPORT_HEADERS = ["group", "region", "affiliation", "name", "hand"];
const PLAYER_IMPORT_SAMPLE_ROWS = [
  ["A", "수원시", "OO초등학교", "홍길동", "right"],
  ["B", "서울시", "OO볼링장", "김민지", "left"],
];

export function createPlayerImportTemplateWorkbook(): XLSX.WorkBook {
  const rows: string[][] = [PLAYER_IMPORT_HEADERS, ...PLAYER_IMPORT_SAMPLE_ROWS];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 10 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Players");
  return workbook;
}

export function downloadPlayerImportTemplate(fileName = "player-import-template.xlsx") {
  const workbook = createPlayerImportTemplateWorkbook();
  XLSX.writeFile(workbook, fileName);
}
