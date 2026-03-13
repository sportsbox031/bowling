import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, jsonCached, setCache } from "@/lib/api-cache";
import { getQuotaExceededMessage, isFirestoreQuotaExceededError } from "@/lib/firebase/quota";

/**
 * GET /api/public/players/search?name=김환
 *
 * 이름으로 글로벌 선수 검색 - 동명이인 구분용.
 * 반환: { players: [{ shortId, name, region, affiliation }] }
 */
export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  try {
    const name = new URL(req.url).searchParams.get("name")?.trim();
    if (!name) {
      return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
    }

    const cacheKey = `player-search:${name}`;
    const cached = getCached<{ players: { shortId: string; name: string; region: string; affiliation: string }[] }>(cacheKey);
    if (cached) {
      return jsonCached(cached, 60);
    }

    const snap = await adminDb
      .collection("globalPlayers")
      .where("name", "==", name)
      .get();

    const players = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        shortId: d.shortId as string,
        name: d.name as string,
        region: (d.region ?? "") as string,
        affiliation: (d.affiliation ?? "") as string,
      };
    });

    const result = { players };
    setCache(cacheKey, result, 60000);
    return jsonCached(result, 60);
  } catch (error) {
    if (isFirestoreQuotaExceededError(error)) {
      return NextResponse.json(
        { code: "QUOTA_EXCEEDED", message: getQuotaExceededMessage("선수 검색을 불러오는") },
        { status: 503 },
      );
    }
    return NextResponse.json({ message: "PLAYER_SEARCH_FAILED" }, { status: 500 });
  }
}
