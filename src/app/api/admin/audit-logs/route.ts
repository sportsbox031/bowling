import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";

const PAGE_SIZE = 50;

/**
 * GET /api/admin/audit-logs
 * 관리자 감사 로그를 최신순으로 조회합니다.
 *
 * Query params:
 *   tournamentId — 대회별 필터 (optional)
 *   targetType   — 대상 유형 필터 (optional)
 *   limit        — 최대 반환 수 (default: 50)
 *   before       — 이 createdAt 이전 항목만 (페이지네이션용, optional)
 */
export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get("tournamentId") ?? "";
  const targetType = searchParams.get("targetType") ?? "";
  const limitParam = parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? PAGE_SIZE : limitParam), 200);
  const before = searchParams.get("before") ?? "";

  let query = adminDb.collection("approvalLogs").orderBy("createdAt", "desc");

  if (tournamentId) {
    query = query.where("tournamentId", "==", tournamentId) as typeof query;
  }
  if (targetType) {
    query = query.where("targetType", "==", targetType) as typeof query;
  }
  if (before) {
    query = query.startAfter(before) as typeof query;
  }

  query = query.limit(limit) as typeof query;

  const snap = await query.get();
  const items = snap.docs.map((doc) => doc.data());

  return NextResponse.json({ items });
}
