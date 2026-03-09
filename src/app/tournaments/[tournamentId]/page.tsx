import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard, GlassButton, GlassBadge } from "@/components/ui";
import { adminDb } from "@/lib/firebase/admin";
import { KIND_LABELS, formatDivisionLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PublicTournamentDetailPage({ params }: { params: { tournamentId: string } }) {
  if (!adminDb) {
    return (
      <main>
        <p style={{ color: "#ef4444", textAlign: "center", padding: "4rem" }}>서버 초기화 오류가 발생했습니다.</p>
      </main>
    );
  }

  const tournamentId = params.tournamentId;
  const tournamentDoc = await adminDb.collection("tournaments").doc(tournamentId).get();
  if (!tournamentDoc.exists) {
    notFound();
  }

  const tournament = { id: tournamentDoc.id, ...(tournamentDoc.data() as Record<string, unknown>) } as {
    id: string;
    title: string;
    region: string;
    startsAt: string;
    endsAt: string;
  };

  const divisionsSnap = await adminDb
    .collection("tournaments")
    .doc(tournamentId)
    .collection("divisions")
    .orderBy("title")
    .get();

  const divisions = divisionsSnap.docs.map((doc) => {
    const data = doc.data() as { title: string; code: string; gender?: string };
    return {
      id: doc.id,
      title: data.title,
      code: data.code,
      gender: data.gender ?? "",
      displayTitle: formatDivisionLabel(data.title, data.gender),
    };
  });

  const eventsByDivision = await Promise.all(
    divisions.map(async (division) => {
      const eventsSnap = await adminDb!
        .collection("tournaments")
        .doc(tournamentId)
        .collection("divisions")
        .doc(division.id)
        .collection("events")
        .orderBy("scheduleDate")
        .get();

      const events = eventsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as { title: string; kind: string; gameCount: number; scheduleDate: string }),
      }));

      return { divisionId: division.id, events };
    }),
  );

  const eventMap = new Map(eventsByDivision.map((item) => [item.divisionId, item.events]));

  return (
    <main>
      <div style={{ marginBottom: 8 }}>
        <Link href="/" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>
          ← 대회 목록
        </Link>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 10,
          }}
        >
          {tournament.title}
        </h1>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <GlassBadge variant="info">{tournament.region}</GlassBadge>
          <span style={{ color: "#64748b", fontSize: 14 }}>{tournament.startsAt} ~ {tournament.endsAt}</span>
        </div>
      </div>

      <section style={{ display: "grid", gap: 16 }}>
        {divisions.length === 0 && (
          <GlassCard variant="subtle" style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
            등록된 부문이 없습니다.
          </GlassCard>
        )}
        {divisions.map((division) => (
          <GlassCard key={division.id} hover>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>{division.displayTitle}</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>등록된 세부 종목을 선택해 성적과 레인 배정을 확인하세요.</p>
              </div>
              <GlassBadge variant="info">{division.code}</GlassBadge>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {(eventMap.get(division.id) ?? []).map((event) => (
                <Link key={event.id} href={`/tournaments/${tournament.id}/events/${event.id}?divisionId=${division.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      background: "rgba(255, 255, 255, 0.22)",
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>
                      {event.title}
                      <span style={{ color: "#6366f1", marginLeft: 8 }}>({KIND_LABELS[event.kind] ?? event.kind})</span>
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>{event.gameCount}게임 · {event.scheduleDate}</span>
                  </div>
                </Link>
              ))}
              {(eventMap.get(division.id) ?? []).length === 0 && (
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>세부종목이 등록되지 않았습니다.</p>
              )}
            </div>
          </GlassCard>
        ))}
      </section>

      {divisions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Link href={`/tournaments/${tournament.id}/overall?divisionId=${divisions[0].id}`}>
            <GlassButton size="lg">종합성적 보기</GlassButton>
          </Link>
        </div>
      )}
    </main>
  );
}

