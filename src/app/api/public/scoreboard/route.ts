import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { buildEventLeaderboard, buildTeamLeaderboard, buildFivesLinkedLeaderboard } from "@/lib/scoring";
import { resolveEventRef } from "@/lib/firebase/eventPath";
import { getCached, setCache, jsonCached } from "@/lib/api-cache";
import type { EventType, Player, Team } from "@/lib/models";

const TEAM_EVENT_KINDS: EventType[] = ["DOUBLES", "TRIPLES", "FIVES"];

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tournamentId = url.searchParams.get("tournamentId");
    const eventId = url.searchParams.get("eventId");
    const divisionId = url.searchParams.get("divisionId") ?? undefined;

    if (!adminDb || !tournamentId || !eventId) {
      return NextResponse.json(
        { message: "INVALID_QUERY" },
        { status: 400 },
      );
    }

    const cacheKey = `scoreboard:${tournamentId}:${divisionId}:${eventId}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      return jsonCached(cached, 60);
    }

    const event = await resolveEventRef(adminDb, tournamentId, eventId, divisionId);
    if (!event) {
      return NextResponse.json({ message: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    const eventDoc = (await event.ref.get()).data() ?? {};

    const [scoreSnap, playersSnap] = await Promise.all([
      adminDb
        .collection("tournaments")
        .doc(tournamentId)
        .collection("divisions")
        .doc(event.divisionId)
        .collection("events")
        .doc(eventId)
        .collection("scores")
        .get(),
      adminDb
        .collection("tournaments")
        .doc(tournamentId)
        .collection("players")
        .get(),
    ]);

    const scores = scoreSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        tournamentId,
        eventId,
        playerId: data.playerId,
        gameNumber: data.gameNumber,
        laneNumber: data.laneNumber ?? 0,
        score: data.score,
        createdAt: data.updatedAt ?? new Date().toISOString(),
      };
    });

    const players = playersSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          tournamentId,
          divisionId: data.divisionId,
          group: data.group,
          region: data.region,
          affiliation: data.affiliation,
          number: data.number,
          name: data.name,
          hand: data.hand,
          createdAt: data.createdAt ?? new Date().toISOString(),
        };
      })
      .filter((player) => player.divisionId === event.divisionId);

    const leaderboard = buildEventLeaderboard({ players, scores, gameCount: eventDoc.gameCount ?? 1 });

    const isTeamEvent = TEAM_EVENT_KINDS.includes(eventDoc.kind as EventType);
    let teamRows = null;

    if (isTeamEvent) {
      const teamsSnap = await event.ref.collection("teams").get();
      const teams = teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));

      if (teams.length > 0) {
        const playerMap = new Map<string, Player>(players.map((p) => [p.id, p]));
        const teamLeaderboard = buildTeamLeaderboard({
          teams,
          playerMap,
          individualRows: leaderboard.rows,
        });
        teamRows = teamLeaderboard.rows;

        // 5인조 전반/후반 연결 처리
        if (eventDoc.kind === "FIVES" && eventDoc.linkedEventId) {
          const linkedEvent = await resolveEventRef(adminDb!, tournamentId, eventDoc.linkedEventId);
          if (linkedEvent) {
            const [linkedTeamsSnap, linkedScoresSnap, linkedEventDoc] = await Promise.all([
              linkedEvent.ref.collection("teams").get(),
              linkedEvent.ref.collection("scores").get(),
              linkedEvent.ref.get(),
            ]);
            const linkedTeams = linkedTeamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Team));
            const linkedScores = linkedScoresSnap.docs.map((doc) => {
              const d = doc.data();
              return {
                id: doc.id, tournamentId, eventId: eventDoc.linkedEventId,
                playerId: d.playerId, gameNumber: d.gameNumber,
                laneNumber: d.laneNumber ?? 0, score: d.score,
                createdAt: d.updatedAt ?? "",
              };
            });
            const linkedEventData = linkedEventDoc.data() ?? {};
            const linkedLeaderboard = buildEventLeaderboard({
              players,
              scores: linkedScores,
              gameCount: linkedEventData.gameCount ?? 1,
            });
            const linkedTeamLeaderboard = buildTeamLeaderboard({
              teams: linkedTeams,
              playerMap,
              individualRows: linkedLeaderboard.rows,
            });

            // 현재 이벤트가 전반인지 후반인지에 따라 순서 결정
            const isFirstHalf = eventDoc.halfType === "FIRST";
            const fivesResult = buildFivesLinkedLeaderboard({
              firstHalfRows: isFirstHalf ? teamRows : linkedTeamLeaderboard.rows,
              secondHalfRows: isFirstHalf ? linkedTeamLeaderboard.rows : teamRows,
            });
            teamRows = fivesResult.rows;
          }
        }
      }
    }

    const result = {
      ...leaderboard,
      ...(teamRows !== null ? { teamRows } : {}),
      event: {
        id: eventId,
        title: eventDoc.title,
        kind: eventDoc.kind,
        gameCount: eventDoc.gameCount,
        scheduleDate: eventDoc.scheduleDate,
        laneStart: eventDoc.laneStart,
        laneEnd: eventDoc.laneEnd,
        tableShift: eventDoc.tableShift,
        linkedEventId: eventDoc.linkedEventId ?? null,
        halfType: eventDoc.halfType ?? null,
      },
    };

    setCache(cacheKey, result, 60000);

    return jsonCached(result, 60);
  } catch (error) {
    return NextResponse.json(
      { message: "LEADERBOARD_FAILED", error: String((error as Error).message) },
      { status: 500 },
    );
  }
}

