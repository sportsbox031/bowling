import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { findOrCreateGlobalPlayer } from "@/lib/shortId";

/**
 * POST /api/admin/migrate-shortids
 *
 * 기존 선수 데이터에 shortId를 일괄 부여하는 마이그레이션 엔드포인트.
 * 한 번만 실행하면 됨. 이미 shortId가 있는 선수는 건너뜀.
 */
export async function POST(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  }

  const tournamentsSnap = await adminDb.collection("tournaments").get();
  let migrated = 0;
  let skipped = 0;

  for (const tDoc of tournamentsSnap.docs) {
    const playersSnap = await adminDb
      .collection("tournaments")
      .doc(tDoc.id)
      .collection("players")
      .get();

    for (const pDoc of playersSnap.docs) {
      const data = pDoc.data();

      // 이미 shortId가 있으면 건너뜀
      if (data.shortId) {
        skipped++;
        continue;
      }

      const shortId = await findOrCreateGlobalPlayer(adminDb, {
        name: data.name ?? "",
        affiliation: data.affiliation ?? "",
        region: data.region ?? "",
      });

      await pDoc.ref.update({ shortId });
      migrated++;
    }
  }

  return NextResponse.json({
    message: "MIGRATION_COMPLETE",
    migrated,
    skipped,
  });
}
