"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GlassCard, GlassButton, GlassSelect } from "@/components/ui";

type Winner = {
  rank: number;
  playerId: string;
  name: string;
  affiliation: string;
  region: string;
  total: number;
};

type EventMedal = {
  eventId: string;
  eventTitle: string;
  eventKind: string;
  winners: Winner[];
};

type DivisionSummary = {
  divisionId: string;
  divisionTitle: string;
  gender: string;
  eventMedals: EventMedal[];
};

type TournamentInfo = {
  id: string;
  title: string;
  host: string;
  startsAt: string;
  endsAt: string;
};

type SummaryData = {
  tournament: TournamentInfo;
  divisions: DivisionSummary[];
};

const RANK_LABELS: Record<number, string> = {
  1: "우 승",
  2: "준우승",
  3: "3 위",
  4: "4 위",
};

const GENDER_LABELS: Record<string, string> = {
  M: "남자",
  F: "여자",
  MIXED: "혼합",
};

const divisionLabel = (div: DivisionSummary) => {
  const g = GENDER_LABELS[div.gender] ?? "";
  return g ? `${div.divisionTitle} ${g}` : div.divisionTitle;
};

const certPageStyle: React.CSSProperties = {
  width: "210mm",
  height: "297mm",
  padding: "30mm 25mm",
  boxSizing: "border-box",
  background: "#fff",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  pageBreakAfter: "always",
  overflow: "hidden",
  fontFamily: "'Noto Sans KR', 'Batang', serif",
};

const borderStyle: React.CSSProperties = {
  position: "absolute",
  top: "12mm",
  left: "12mm",
  right: "12mm",
  bottom: "12mm",
  border: "3px double #b8860b",
  pointerEvents: "none",
};

const innerBorderStyle: React.CSSProperties = {
  position: "absolute",
  top: "16mm",
  left: "16mm",
  right: "16mm",
  bottom: "16mm",
  border: "1px solid #d4a843",
  pointerEvents: "none",
};

const printStyles = `
@media print {
  @page { size: 210mm 297mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; width: 210mm; background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body::before, body::after { display: none !important; }
  /* 레이아웃 전체 숨기기: 헤더 등 */
  header, nav, .no-print { display: none !important; }
  /* admin layout main 래퍼 padding 제거 */
  main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .cert-container { padding: 0 !important; max-width: none !important; width: 210mm !important; margin: 0 !important; }
  .cert-page { box-shadow: none !important; margin: 0 !important; width: 210mm !important; height: 297mm !important; page-break-after: always; page-break-inside: avoid; }
}
@media screen {
  .cert-page { box-shadow: 0 2px 16px rgba(0,0,0,0.12); margin-bottom: 32px; }
}
`;

type CertData = {
  tournamentTitle: string;
  host: string;
  divisionTitle: string;
  eventTitle: string;
  rankLabel: string;
  name: string;
  affiliation: string;
  dateStr: string;
};

function Certificate({ cert }: { cert: CertData }) {
  return (
    <div className="cert-page" style={certPageStyle}>
      <div style={borderStyle} />
      <div style={innerBorderStyle} />

      {/* 상장 제목 */}
      <h1 style={{
        fontSize: "42pt",
        fontWeight: 800,
        letterSpacing: "16px",
        color: "#1a1a1a",
        marginBottom: "36mm",
        textAlign: "center",
      }}>
        상 장
      </h1>

      {/* 부문/종목/입상 정보 */}
      <div style={{
        textAlign: "center",
        marginBottom: "12mm",
        fontSize: "16pt",
        color: "#333",
        lineHeight: 2.2,
      }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "20mm" }}>
          <span>{cert.divisionTitle} {cert.eventTitle}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "20mm", marginTop: "4mm" }}>
          <span><strong>{cert.rankLabel}</strong></span>
          <span>{cert.affiliation}</span>
        </div>
        <div style={{ fontSize: "22pt", fontWeight: 700, marginTop: "6mm", letterSpacing: "8px" }}>
          {cert.name}
        </div>
      </div>

      {/* 본문 */}
      <p style={{
        textAlign: "center",
        fontSize: "14pt",
        color: "#333",
        lineHeight: 2.0,
        marginTop: "16mm",
        marginBottom: "24mm",
        maxWidth: "140mm",
      }}>
        위 사람은 {cert.tournamentTitle} 에서
        <br />
        우수한 성적으로 입상하였기에
        <br />
        이 상장을 수여합니다.
      </p>

      {/* 날짜 */}
      <p style={{
        fontSize: "14pt",
        color: "#444",
        marginBottom: "20mm",
        textAlign: "center",
      }}>
        {cert.dateStr}
      </p>

      {/* 수여기관 */}
      <div style={{
        textAlign: "center",
        fontSize: "15pt",
        color: "#333",
        lineHeight: 2.0,
      }}>
        <div>{cert.host}</div>
        <div style={{ fontSize: "16pt", fontWeight: 700, letterSpacing: "4px" }}>
          회장
        </div>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("__all__");
  const [maxRank, setMaxRank] = useState(4);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    fetch(`/api/admin/tournaments/${tournamentId}/summary`)
      .then((r) => r.json())
      .then((d: SummaryData) => {
        setData(d);
        if (d.divisions.length > 0) setSelectedDivisionId(d.divisions[0].divisionId);
      })
      .catch((e) => {
        console.error("[certificates] 데이터 로드 실패", e);
        setError("데이터 로드 실패");
      })
      .finally(() => setLoading(false));
  }, [tournamentId]);

  const selectedDivision = useMemo(
    () => data?.divisions.find((d) => d.divisionId === selectedDivisionId) ?? null,
    [data, selectedDivisionId],
  );

  const filteredEvents = useMemo(() => {
    if (!selectedDivision) return [];
    if (selectedEventId === "__all__") return selectedDivision.eventMedals;
    return selectedDivision.eventMedals.filter((e) => e.eventId === selectedEventId);
  }, [selectedDivision, selectedEventId]);

  const certificates = useMemo((): CertData[] => {
    if (!data || !selectedDivision) return [];
    const certs: CertData[] = [];
    const dateStr = data.tournament.endsAt
      ? formatDateKorean(data.tournament.endsAt)
      : "";

    for (const ev of filteredEvents) {
      for (const w of ev.winners) {
        if (w.rank > maxRank) continue;
        certs.push({
          tournamentTitle: data.tournament.title,
          host: data.tournament.host || "",
          divisionTitle: divisionLabel(selectedDivision),
          eventTitle: ev.eventTitle,
          rankLabel: RANK_LABELS[w.rank] ?? `${w.rank}위`,
          name: w.name,
          affiliation: w.affiliation,
          dateStr,
        });
      }
    }
    return certs;
  }, [data, selectedDivision, filteredEvents, maxRank]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div className="skeleton" style={{ width: 200, height: 24, margin: "0 auto 16px" }} />
        <div className="skeleton" style={{ width: 400, height: 300, margin: "0 auto" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#ef4444" }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <>
      <style>{printStyles}</style>
      <div className="cert-container" style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
        {/* Controls */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <Link href={`/admin/tournaments/${tournamentId}`}>
              <GlassButton size="sm" variant="ghost">← 대회관리</GlassButton>
            </Link>
            <Link href={`/admin/tournaments/${tournamentId}/summary`}>
              <GlassButton size="sm" variant="secondary">📊 종합집계표</GlassButton>
            </Link>
            <GlassButton size="sm" variant="primary" onClick={() => window.print()}>
              🖨️ 인쇄
            </GlassButton>
          </div>

          <GlassCard>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              {/* Division select */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>종별</label>
                <GlassSelect
                  value={selectedDivisionId}
                  onChange={(e) => {
                    setSelectedDivisionId(e.target.value);
                    setSelectedEventId("__all__");
                  }}
                >
                  {data.divisions.map((d) => (
                    <option key={d.divisionId} value={d.divisionId}>{divisionLabel(d)}</option>
                  ))}
                </GlassSelect>
              </div>

              {/* Event select */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>종목</label>
                <GlassSelect
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                >
                  <option value="__all__">전체 종목</option>
                  {selectedDivision?.eventMedals.map((ev) => (
                    <option key={ev.eventId} value={ev.eventId}>{ev.eventTitle}</option>
                  ))}
                </GlassSelect>
              </div>

              {/* Max rank */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 4 }}>입상 범위</label>
                <GlassSelect
                  value={String(maxRank)}
                  onChange={(e) => setMaxRank(Number(e.target.value))}
                >
                  <option value="1">우승만</option>
                  <option value="2">우승~준우승</option>
                  <option value="3">우승~3위</option>
                  <option value="4">우승~4위</option>
                </GlassSelect>
              </div>

              <div style={{ fontSize: 14, color: "#64748b", paddingBottom: 6 }}>
                총 <strong style={{ color: "#6366f1" }}>{certificates.length}</strong>장
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Certificates preview */}
        {certificates.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
            생성할 상장이 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {certificates.map((cert, i) => (
              <Certificate key={i} cert={cert} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function formatDateKorean(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    return `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
  }
  return dateStr;
}
