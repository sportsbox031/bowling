import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { rebuildPublicTournamentListAggregate } from "@/lib/aggregates/public-tournament";
import { invalidateCache } from "@/lib/api-cache";

/**
 * POST /api/admin/tournaments/[tournamentId]/clone
 * 대회 구조(종별 + 세부종목)를 복제합니다.
 * 선수, 점수, 배정, 제출 데이터는 복제하지 않습니다.
 *
 * Body: { title: string, startsAt: string, endsAt: string }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { tournamentId: string } }
) {
  const { tournamentId } = ctx.params;

  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    title?: string;
    startsAt?: string;
    endsAt?: string;
  } | null;

  const title = String(body?.title ?? "").trim();
  const startsAt = String(body?.startsAt ?? "").trim();
  const endsAt = String(body?.endsAt ?? "").trim();

  if (!title || !startsAt || !endsAt) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  // 원본 대회 로드
  const srcTournamentSnap = await adminDb.doc(`tournaments/${tournamentId}`).get();
  if (!srcTournamentSnap.exists) {
    return NextResponse.json({ message: "TOURNAMENT_NOT_FOUND" }, { status: 404 });
  }
  const srcTournament = srcTournamentSnap.data()!;

  // 새 대회 ID
  const newTournamentRef = adminDb.collection("tournaments").doc();
  const newTournamentId = newTournamentRef.id;
  const now = new Date().toISOString();

  // 원본 종별 목록 로드
  const divisionsSnap = await adminDb
    .collection(`tournaments/${tournamentId}/divisions`)
    .get();

  // FIVES linkedEventId 재매핑: 원본 eventId → 새 eventId
  const eventIdMap = new Map<string, string>();

  // 새 이벤트 데이터 수집 (링크 재연결 전)
  type NewEventData = {
    divisionId: string;
    newEventId: string;
    data: Record<string, unknown>;
    srcLinkedEventId?: string;
  };
  const newEvents: NewEventData[] = [];

  // 1단계: 새 ID 생성 및 기본 데이터 준비
  for (const divDoc of divisionsSnap.docs) {
    const eventsSnap = await adminDb
      .collection(`tournaments/${tournamentId}/divisions/${divDoc.id}/events`)
      .get();

    for (const evDoc of eventsSnap.docs) {
      const newEventRef = adminDb
        .collection(`tournaments/${newTournamentId}/divisions/${divDoc.id}/events`)
        .doc();
      eventIdMap.set(evDoc.id, newEventRef.id);

      const evData = evDoc.data();
      newEvents.push({
        divisionId: divDoc.id,
        newEventId: newEventRef.id,
        srcLinkedEventId: typeof evData.linkedEventId === "string" ? evData.linkedEventId : undefined,
        data: {
          ...evData,
          id: newEventRef.id,
          tournamentId: newTournamentId,
          createdAt: now,
          updatedAt: now,
          // 점수/배정 관련 상태 초기화
          rankRefreshPending: false,
          rankRefreshedAt: null,
          linkedEventId: undefined, // 2단계에서 설정
        },
      });
    }
  }

  // 2단계: linkedEventId 재연결
  for (const ev of newEvents) {
    if (ev.srcLinkedEventId) {
      const newLinkedId = eventIdMap.get(ev.srcLinkedEventId);
      if (newLinkedId) {
        ev.data.linkedEventId = newLinkedId;
      }
    } else {
      delete ev.data.linkedEventId;
    }
  }

  // 3단계: Firestore 배치 쓰기 (500개 한도로 분할)
  const BATCH_LIMIT = 400;
  let batch = adminDb.batch();
  let opCount = 0;

  const flush = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = adminDb!.batch();
      opCount = 0;
    }
  };

  // 새 대회 document
  batch.set(newTournamentRef, {
    ...srcTournament,
    id: newTournamentId,
    title,
    startsAt,
    endsAt,
    status: "UPCOMING",
    createdAt: now,
    updatedAt: now,
  });
  opCount++;

  // 종별 복제
  for (const divDoc of divisionsSnap.docs) {
    const newDivRef = adminDb
      .collection(`tournaments/${newTournamentId}/divisions`)
      .doc(divDoc.id); // 종별은 같은 ID 유지 (이벤트 참조 일관성)
    batch.set(newDivRef, {
      ...divDoc.data(),
      tournamentId: newTournamentId,
      createdAt: now,
      updatedAt: now,
    });
    opCount++;
    if (opCount >= BATCH_LIMIT) await flush();
  }

  // 이벤트 복제
  for (const ev of newEvents) {
    const newEvRef = adminDb
      .collection(`tournaments/${newTournamentId}/divisions/${ev.divisionId}/events`)
      .doc(ev.newEventId);
    batch.set(newEvRef, ev.data);
    opCount++;
    if (opCount >= BATCH_LIMIT) await flush();
  }

  await flush();

  // 공개 캐시 갱신
  invalidateCache("pub-tournaments:");
  await rebuildPublicTournamentListAggregate(adminDb).catch(() => null);

  return NextResponse.json({
    newTournamentId,
    title,
    divisionCount: divisionsSnap.size,
    eventCount: newEvents.length,
  }, { status: 201 });
}
