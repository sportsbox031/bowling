import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

interface EventProgress {
  eventId: string;
  divisionId: string;
  eventTitle: string;
  eventKind: string;
  participantCount: number;
  gameCount: number;
  filledScores: number;
  totalScores: number;
  completionPct: number;
}

/**
 * GET /api/admin/tournaments/[tournamentId]/progress
 * 대회 내 모든 이벤트의 점수 입력 진행률을 반환합니다.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string } }
) {
  const { tournamentId } = ctx.params;

  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const divisionsSnap = await adminDb
    .collection(`tournaments/${tournamentId}/divisions`)
    .get();

  const results: EventProgress[] = [];

  await Promise.all(
    divisionsSnap.docs.map(async (divDoc) => {
      const divisionId = divDoc.id;

      const eventsSnap = await adminDb!
        .collection(`tournaments/${tournamentId}/divisions/${divisionId}/events`)
        .get();

      await Promise.all(
        eventsSnap.docs.map(async (evDoc) => {
          const ev = evDoc.data();
          // OVERALL 이벤트는 집계용이므로 제외
          if (ev.kind === "OVERALL") return;

          const gameCount: number = ev.gameCount ?? 0;

          // 참여자 수
          const participantsSnap = await adminDb!
            .collection(`tournaments/${tournamentId}/divisions/${divisionId}/events/${evDoc.id}/participants`)
            .count()
            .get();
          const participantCount = participantsSnap.data().count;

          // 입력된 점수 수
          const scoresSnap = await adminDb!
            .collection(`tournaments/${tournamentId}/divisions/${divisionId}/events/${evDoc.id}/scores`)
            .count()
            .get();
          const filledScores = scoresSnap.data().count;

          const totalScores = participantCount * gameCount;
          const completionPct = totalScores > 0
            ? Math.round((filledScores / totalScores) * 100)
            : 0;

          results.push({
            eventId: evDoc.id,
            divisionId,
            eventTitle: ev.title ?? "",
            eventKind: ev.kind ?? "",
            participantCount,
            gameCount,
            filledScores,
            totalScores,
            completionPct,
          });
        })
      );
    })
  );

  // 종별 > 이벤트 생성순 정렬
  results.sort((a, b) => {
    if (a.divisionId !== b.divisionId) return a.divisionId.localeCompare(b.divisionId);
    return a.eventId.localeCompare(b.eventId);
  });

  return NextResponse.json({ items: results });
}
