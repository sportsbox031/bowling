import Link from "next/link";

export const dynamic = "force-dynamic";

const formatEventKind = (kind: string) => {
  const map: Record<string, string> = {
    SINGLE: "개인전",
    DOUBLES: "2인조",
    TRIPLES: "3인조",
    FOURS: "4인조",
    FIVES: "5인조",
    OVERALL: "개인종합",
  };

  return map[kind] ?? kind;
};

type DivisionInfo = {
  id: string;
  title: string;
  code: string;
};

type EventInfo = {
  id: string;
  divisionId: string;
  title: string;
  kind: string;
  gameCount: number;
  scheduleDate: string;
};

type TournamentDetail = {
  id: string;
  title: string;
  region: string;
  startsAt: string;
  endsAt: string;
};

type DivisionSection = {
  divisionId: string;
  events: EventInfo[];
};

const getTournamentData = async (tournamentId: string) => {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/public/tournaments/${tournamentId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("대회 정보를 가져오지 못했습니다.");
  }

  const raw = await res.json();
  return raw as {
    tournament: TournamentDetail;
    divisions: DivisionInfo[];
    eventsByDivision: DivisionSection[];
  };
};

export default async function PublicTournamentDetailPage({ params }: { params: { tournamentId: string } }) {
  const { tournament, divisions, eventsByDivision } = await getTournamentData(params.tournamentId);
  const eventMap = new Map<string, EventInfo[]>(eventsByDivision.map((item) => [item.divisionId, item.events]));

  return (
    <main>
      {/* Tournament Header */}
      <div style={{ marginBottom: 32, paddingTop: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <Link href="/" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
            ← 대회 목록
          </Link>
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}
        >
          {tournament.title}
        </h1>
        <div style={{ display: "flex", gap: 16, color: "#64748b", fontSize: 14 }}>
          <span>📅 {tournament.startsAt} ~ {tournament.endsAt}</span>
          <span>📍 {tournament.region}</span>
        </div>
      </div>

      {/* Divisions Grid */}
      <section style={{ display: "grid", gap: 16 }}>
        {divisions.map((division) => (
          <div
            key={division.id}
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255, 255, 255, 0.35)",
              borderRadius: 16,
              padding: "1.25rem",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>{division.title}</h2>
              <span
                style={{
                  padding: "3px 10px",
                  background: "rgba(99, 102, 241, 0.1)",
                  borderRadius: 20,
                  fontSize: 12,
                  color: "#6366f1",
                  fontWeight: 600,
                }}
              >
                {division.code}
              </span>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {(eventMap.get(division.id) ?? []).map((event) => (
                <Link
                  key={event.id}
                  href={`/tournaments/${tournament.id}/events/${event.id}?divisionId=${division.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "rgba(255, 255, 255, 0.2)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "#1e293b",
                    transition: "background 0.2s ease",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {event.title}
                    <span style={{ color: "#6366f1", marginLeft: 8 }}>({formatEventKind(event.kind)})</span>
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>
                    {event.gameCount}게임 · {event.scheduleDate}
                  </span>
                </Link>
              ))}
              {(eventMap.get(division.id) ?? []).length === 0 && (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>
                  세부종목이 등록되지 않았습니다.
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Overall Link */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link
          href={`/tournaments/${tournament.id}/overall?divisionId=${divisions[0]?.id ?? ""}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 28px",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(139, 92, 246, 0.85))",
            color: "#fff",
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)",
          }}
        >
          📊 종합성적 보기
        </Link>
      </div>
    </main>
  );
}
