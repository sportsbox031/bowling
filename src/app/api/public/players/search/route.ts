import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonCached } from "@/lib/api-cache";

/**
 * GET /api/public/players/search?name=김환
 *
 * 이름으로 글로벌 선수 검색 — 동명이인 구분용.
 * 반환: { players: [{ shortId, name, region, affiliation }] }
 */
export async function GET(req: NextRequest) {
  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
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

  return jsonCached({ players }, 60);
}
