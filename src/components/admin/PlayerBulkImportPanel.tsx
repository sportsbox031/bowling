"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { GlassButton, GlassCard } from "@/components/ui";
import StatusBanner from "@/components/common/StatusBanner";
import { downloadPlayerImportTemplate } from "@/lib/admin/player-import-template";

type ImportedPlayer = {
  group: string;
  region: string;
  affiliation: string;
  name: string;
  hand: "left" | "right";
};

type PreviewRow = ImportedPlayer & {
  rowNumber: number;
  errors: string[];
};

type PlayerBulkImportPanelProps = {
  tournamentId: string;
  divisionId: string;
  onImported: () => Promise<void> | void;
};

const REQUIRED_HEADERS = ["group", "region", "affiliation", "name", "hand"];
const ACCEPTED_FILE_TYPES = ".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const parseDelimited = (text: string, delimiter: "," | "\t") => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
};

const detectDelimiter = (text: string): "," | "\t" => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") ? "\t" : ",";
};

const normalizeHand = (value: string): ImportedPlayer["hand"] | null => {
  const normalized = value.trim().toLowerCase();
  if (["left", "l", "왼", "왼손"].includes(normalized)) return "left";
  if (["right", "r", "오른", "오른손"].includes(normalized)) return "right";
  return null;
};

const parseWorkbookRows = (sheetRows: string[][]): { rows: PreviewRow[]; missingHeaders: string[] } => {
  if (sheetRows.length === 0) {
    return { rows: [], missingHeaders: REQUIRED_HEADERS };
  }

  const headerMap = sheetRows[0].map((header) => String(header ?? "").trim().toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerMap.includes(header));
  if (missingHeaders.length > 0) {
    return { rows: [], missingHeaders };
  }

  const rows = sheetRows.slice(1).map((cells, index) => {
    const get = (name: string) => String(cells[headerMap.indexOf(name)] ?? "").trim();
    const handValue = normalizeHand(get("hand"));
    const nextRow: PreviewRow = {
      rowNumber: index + 2,
      group: get("group"),
      region: get("region"),
      affiliation: get("affiliation"),
      name: get("name"),
      hand: handValue ?? "right",
      errors: [],
    };

    if (!nextRow.group) nextRow.errors.push("group 누락");
    if (!nextRow.region) nextRow.errors.push("region 누락");
    if (!nextRow.affiliation) nextRow.errors.push("affiliation 누락");
    if (!nextRow.name) nextRow.errors.push("name 누락");
    if (!handValue) nextRow.errors.push("hand 값 오류");

    return nextRow;
  }).filter((row) => row.group || row.region || row.affiliation || row.name || row.errors.length > 0);

  return { rows, missingHeaders: [] };
};

export default function PlayerBulkImportPanel({ tournamentId, divisionId, onImported }: PlayerBulkImportPanelProps) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [sourceFileName, setSourceFileName] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"error" | "success" | "info">("info");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => rows.slice(0, 8), [rows]);
  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => row.errors.length > 0), [rows]);

  const handleTemplateDownload = () => {
    downloadPlayerImportTemplate();
    setTone("info");
    setMessage("양식을 내려받았습니다. 예시 행을 참고해 내용을 입력한 뒤 업로드해 주세요.");
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      const isSpreadsheet = lowerName.endsWith(".xlsx");
      let parsedRows: string[][] = [];

      if (isSpreadsheet) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
        parsedRows = firstSheet ? (XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as string[][]) : [];
      } else {
        const text = await file.text();
        const delimiter = lowerName.endsWith(".tsv") ? "\t" : detectDelimiter(text);
        parsedRows = parseDelimited(text, delimiter);
      }

      const result = parseWorkbookRows(parsedRows);
      setSourceFileName(file.name);

      if (result.missingHeaders.length > 0) {
        setTone("error");
        setMessage(`누락된 헤더: ${result.missingHeaders.join(", ")}`);
        setRows([]);
        return;
      }

      setRows(result.rows);
      if (result.rows.length === 0) {
        setTone("error");
        setMessage("헤더 아래에 읽을 데이터가 없습니다.");
        return;
      }

      if (result.rows.some((row) => row.errors.length > 0)) {
        setTone("error");
        setMessage(`${file.name}에서 ${result.rows.length}행을 읽었고, ${result.rows.filter((row) => row.errors.length > 0).length}행에 오류가 있습니다.`);
      } else {
        setTone("info");
        setMessage(`${file.name}에서 ${result.rows.length}명을 읽었습니다.`);
      }
    } catch (error) {
      setRows([]);
      setSourceFileName(file.name);
      setTone("error");
      setMessage((error as Error).message || "파일을 읽는 중 오류가 발생했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!validRows.length || invalidRows.length > 0) return;
    setBusy(true);
    try {
      const payload = validRows.map(({ rowNumber: _rowNumber, errors: _errors, ...player }) => player);
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/players/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ divisionId, players: payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "선수 일괄 등록에 실패했습니다.");
      }
      setTone("success");
      setMessage(data?.count ? `${data.count}명의 선수를 등록했습니다.` : "추가로 등록할 새 선수가 없습니다.");
      setRows([]);
      setSourceFileName("");
      await onImported();
    } catch (error) {
      setTone("error");
      setMessage((error as Error).message || "선수 일괄 등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard variant="strong" style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>엑셀/CSV 일괄 등록</h3>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
            1. 양식을 다운로드한 뒤 선수 정보를 입력하고, 2. 작성한 파일을 업로드하면, 3. 미리보기 확인 후 한 번에 등록할 수 있습니다.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <GlassButton type="button" size="sm" variant="secondary" onClick={handleTemplateDownload}>
            양식 다운로드
          </GlassButton>
          <label style={{ display: "inline-flex", alignItems: "center" }}>
            <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleFile} style={{ display: "none" }} />
            <span style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#334155" }}>파일 선택</span>
          </label>
          <GlassButton type="button" size="sm" onClick={() => void handleImport()} disabled={busy || validRows.length === 0 || invalidRows.length > 0}>
            {busy ? "등록 중..." : `${validRows.length}명 등록`}
          </GlassButton>
        </div>
      </div>

      <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>업로드 헤더: group, region, affiliation, name, hand</p>
      <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>hand 값은 right 또는 left 를 사용합니다.</p>
      <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: 12 }}>예시 행: A, 수원시, OO초등학교, 홍길동, right</p>
      {sourceFileName && <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 12 }}>선택 파일: {sourceFileName}</p>}

      {message && <StatusBanner tone={tone} style={{ marginTop: 14 }}>{message}</StatusBanner>}

      {rows.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: "#0f766e", fontWeight: 700 }}>정상 {validRows.length}건</span>
            <span style={{ color: invalidRows.length > 0 ? "#dc2626" : "#64748b", fontWeight: 700 }}>오류 {invalidRows.length}건</span>
          </div>
          {preview.map((row) => (
            <div
              key={`${row.rowNumber}-${row.name}-${row.affiliation}`}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 60px 1fr 1fr 1fr 90px",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: row.errors.length > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.28)",
                border: row.errors.length > 0 ? "1px solid rgba(239,68,68,0.22)" : "1px solid rgba(255,255,255,0.32)",
                fontSize: 13,
                alignItems: "center",
              }}
            >
              <strong>{row.rowNumber}행</strong>
              <span>{row.group}</span>
              <span>{row.region}</span>
              <span>{row.affiliation}</span>
              <span>{row.name}</span>
              <span>{row.hand === "left" ? "왼손" : "오른손"}</span>
              {row.errors.length > 0 && (
                <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 12, fontWeight: 600 }}>
                  {row.errors.join(", ")}
                </div>
              )}
            </div>
          ))}
          {rows.length > preview.length && <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>외 {rows.length - preview.length}행</p>}
        </div>
      )}
    </GlassCard>
  );
}
