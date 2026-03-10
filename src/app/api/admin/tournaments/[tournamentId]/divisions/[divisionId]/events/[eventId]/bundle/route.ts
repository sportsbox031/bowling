import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard, buildOverallLeaderboard, buildTeamLeaderboard, buildFivesLinkedLeaderboard, MAX_GAME_COUNT } from "@/lib/scoring";
import { getCached, setCache } from "@/lib/api-cache";
import type { Firestore } from "firebase-admin/firestore";
import type { EventType, Player, Team } from "@/lib/models";

const TEAM_EVENT_KINDS: EventType[] = ["DOUBLES", "TRIPLES", "FIVES"];

/**
 * Consolidated API: returns event, players, participants, squads,
 * assignments, event leaderboard, and overall leaderboard in a single call.
 *
 * Query params:
 *   ?only=scores        — only scores + overall (for polling on score/rank tabs)
 *   ?only=assignments   — only assignments (for polling on lane tab)
 *   (no param)          — full bundle (initial load)
 */

const getEventGameCount = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(MAX_GAME_COUNT, Math.max(1, Math.floor(value)));
};

// Shared helpers
const mapScoreDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot, tournamentId: string, eventId: string) => {
  const d = doc.data();
  return {
    id: doc.id, tournamentId, eventId,
    playerId: d.playerId as string,
    gameNumber: d.gameNumber as number,
    laneNumber: (d.laneNumber ?? 0) as number,
    score: d.score as number,
    createdAt: (d.updatedAt ?? "") as string,
  };
};

const buildOverallForDivision = async (
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  currentEventId: string,
  currentEventRows: ReturnType<typeof buildEventLeaderboard>["rows"],
  players: any[],
) => {
  const eventRowsByEventId: Record<string, ReturnType<typeof buildEventLeaderboard>["rows"]> = {};
  eventRowsByEventId[currentEventId] = currentEventRows;

  const eventsSnap = await db
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").get();

  // 이벤트 제목 맵 구성
  const eventTitleMap: Record<string, string> = {};
  for (const doc of eventsSnap.docs) {
    eventTitleMap[doc.id] = doc.data().title ?? doc.id;
  }

  const otherEventDocs = eventsSnap.docs.filter((d) => d.id !== currentEventId);
  if (otherEventDocs.length > 0) {
    const otherScores = await Promise.all(
      otherEventDocs.map((ed) =>
        ed.ref.collection("scores").get().then((snap) => ({
          eventId: ed.id,
          gameCount: getEventGameCount(ed.data().gameCount),
          scores: snap.docs.map((sd) => mapScoreDoc(sd, tournamentId, ed.id)),
        })),
      ),
    );
    for (const os of otherScores) {
      const lb = buildEventLeaderboard({ players, scores: os.scores, gameCount: os.gameCount });
      eventRowsByEventId[os.eventId] = lb.rows;
    }
  }

  const result = buildOverallLeaderboard({
    playerIds: players.map((p) => p.id),
    eventRowsByEventId,
  });

  return { ...result, eventTitleMap };
};

export async function GET(
  req: NextRequest,
  ctx: { params: { tournamentId: string; divisionId: string; eventId: string } },
) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const { tournamentId, divisionId, eventId } = ctx.params;
  const only = new URL(req.url).searchParams.get("only") ?? "";

  const eventRef = adminDb
    .collection("tournaments").doc(tournamentId)
    .collection("divisions").doc(divisionId)
    .collection("events").doc(eventId);

  // --- Partial: assignments only (lane tab polling) ---
  if (only === "assignments") {
    const cacheKey = `bundle-assign:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const snap = await eventRef.collection("assignments").orderBy("gameNumber").get();
    const assignments = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const result = { assignments };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  // --- Partial: scores only (score/rank tab polling) ---
  if (only === "scores") {
    const cacheKey = `bundle-scores:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [eventDoc, scoresSnap, playersSnap] = await Promise.all([
      eventRef.get(),
      eventRef.collection("scores").get(),
      adminDb.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
    ]);

    if (!eventDoc.exists) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const eventData = eventDoc.data() ?? {};
    const players = playersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
    const scores = scoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, eventId));
    const eventLeaderboard = buildEventLeaderboard({
      players,
      scores,
      gameCount: getEventGameCount(eventData.gameCount),
    });
    const overall = await buildOverallForDivision(adminDb, tournamentId, divisionId, eventId, eventLeaderboard.rows, players);

    // 팀 이벤트 polling 시에도 팀 리더보드 갱신
    const isTeamEvent = TEAM_EVENT_KINDS.includes(eventData.kind as EventType);
    let teamRows = null;
    let fivesCombinedRows = null;
    if (isTeamEvent) {
      const teamsSnap = await eventRef.collection("teams").get();
      const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
      if (teams.length > 0) {
        const playerMap = new Map<string, Player>(players.map((p: Player) => [p.id, p]));
        const teamLeaderboard = buildTeamLeaderboard({ teams, playerMap, individualRows: eventLeaderboard.rows });
        teamRows = teamLeaderboard.rows;

        // 5인조 합산
        if (eventData.kind === "FIVES" && eventData.linkedEventId) {
          try {
            const linkedRef = adminDb.collection("tournaments").doc(tournamentId)
              .collection("divisions").doc(divisionId)
              .collection("events").doc(eventData.linkedEventId);
            const [linkedDoc, linkedScoresSnap, linkedTeamsSnap] = await Promise.all([
              linkedRef.get(), linkedRef.collection("scores").get(), linkedRef.collection("teams").get(),
            ]);
            if (linkedDoc.exists && linkedTeamsSnap.size > 0) {
              const linkedScores = linkedScoresSnap.docs.map((sd) => mapScoreDoc(sd, tournamentId, eventData.linkedEventId));
              const linkedTeams = linkedTeamsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
              const linkedLb = buildEventLeaderboard({
                players, scores: linkedScores, gameCount: getEventGameCount(linkedDoc.data()?.gameCount),
              });
              const linkedTeamRows = buildTeamLeaderboard({ teams: linkedTeams, playerMap, individualRows: linkedLb.rows }).rows;
              const isFirst = eventData.halfType === "FIRST";
              fivesCombinedRows = buildFivesLinkedLeaderboard({
                firstHalfRows: isFirst ? teamRows : linkedTeamRows,
                secondHalfRows: isFirst ? linkedTeamRows : teamRows,
              }).rows;
            }
          } catch { /* ignore */ }
        }
      }
    }

    const result = {
      eventRows: eventLeaderboard.rows,
      overallRows: overall.rows,
      eventTitleMap: overall.eventTitleMap,
      ...(teamRows !== null ? { teamRows } : {}),
      ...(fivesCombinedRows !== null ? { fivesCombinedRows } : {}),
    };
    setCache(cacheKey, result, 10000);
    return NextResponse.json(result);
  }

  // --- Full bundle (initial load) ---
  const cacheKey = `bundle-full:${tournamentId}:${divisionId}:${eventId}`;
  const cached = getCached<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [eventDoc, playersSnap, participantsSnap, squadsSnap, assignmentsSnap, scoresSnap, teamsSnap] =
    await Promise.all([
      eventRef.get(),
      adminDb.collection("tournaments").doc(tournamentId)
        .collection("players").where("divisionId", "==", divisionId).get(),
      eventRef.collection("participants").get(),
      eventRef.collection("squads").orderBy("createdAt").get(),
      eventRef.collection("assignments").orderBy("gameNumber").get(),
      eventRef.collection("scores").get(),
      eventRef.collection("teams").orderBy("createdAt").get(),
    ]);

  if (!eventDoc.exists) {
    return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const eventData = { id: eventDoc.id, ...eventDoc.data() } as any;
  const allPlayers = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as any))
    .sort((a: any, b: any) => (a.number ?? 0) - (b.number ?? 0));
  const participants = participantsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const squads = squadsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const assignments = assignmentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const scores = scoresSnap.docs.map((doc) => mapScoreDoc(doc, tournamentId, eventId));
  const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));

  const eventLeaderboard = buildEventLeaderboard({
    players: allPlayers,
    scores,
    gameCount: getEventGameCount(eventData.gameCount),
  });
  const overall = await buildOverallForDivision(adminDb, tournamentId, divisionId, eventId, eventLeaderboard.rows, allPlayers);

  // 팀 이벤트인 경우 팀 리더보드 계산
  const isTeamEvent = TEAM_EVENT_KINDS.includes(eventData.kind as EventType);
  let teamRows = null;
  let fivesCombinedRows = null;
  if (isTeamEvent && teams.length > 0) {
    const playerMap = new Map<string, Player>(allPlayers.map((p: Player) => [p.id, p]));
    const teamLeaderboard = buildTeamLeaderboard({
      teams,
      playerMap,
      individualRows: eventLeaderboard.rows,
    });
    teamRows = teamLeaderboard.rows;

    // 5인조: 전반+후반 합산 리더보드
    if (eventData.kind === "FIVES" && eventData.linkedEventId) {
      try {
        const linkedEventRef = adminDb.collection("tournaments").doc(tournamentId)
          .collection("divisions").doc(divisionId)
          .collection("events").doc(eventData.linkedEventId);
        const [linkedEventDoc, linkedScoresSnap, linkedTeamsSnap] = await Promise.all([
          linkedEventRef.get(),
          linkedEventRef.collection("scores").get(),
          linkedEventRef.collection("teams").orderBy("createdAt").get(),
        ]);
        if (linkedEventDoc.exists && linkedTeamsSnap.size > 0) {
          const linkedEventData = linkedEventDoc.data() ?? {};
          const linkedScores = linkedScoresSnap.docs.map((sd) => mapScoreDoc(sd, tournamentId, eventData.linkedEventId));
          const linkedTeams = linkedTeamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
          const linkedLeaderboard = buildEventLeaderboard({
            players: allPlayers,
            scores: linkedScores,
            gameCount: getEventGameCount(linkedEventData.gameCount),
          });
          const linkedTeamRows = buildTeamLeaderboard({
            teams: linkedTeams,
            playerMap,
            individualRows: linkedLeaderboard.rows,
          }).rows;

          const isFirstHalf = eventData.halfType === "FIRST";
          fivesCombinedRows = buildFivesLinkedLeaderboard({
            firstHalfRows: isFirstHalf ? teamRows : linkedTeamRows,
            secondHalfRows: isFirstHalf ? linkedTeamRows : teamRows,
          }).rows;
        }
      } catch { /* 연결 이벤트 없으면 무시 */ }
    }
  }

  const result = {
    event: eventData,
    players: allPlayers,
    participants,
    squads,
    assignments,
    teams,
    eventRows: eventLeaderboard.rows,
    overallRows: overall.rows,
    eventTitleMap: overall.eventTitleMap,
    ...(teamRows !== null ? { teamRows } : {}),
    ...(fivesCombinedRows !== null ? { fivesCombinedRows } : {}),
  };

  setCache(cacheKey, result, 15000);
  return NextResponse.json(result);
}
