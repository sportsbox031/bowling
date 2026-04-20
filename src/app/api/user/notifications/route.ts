import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET  /api/user/notifications  — 읽지 않은 알림 목록
 * POST /api/user/notifications  — 알림 읽음 처리 { ids: string[] }
 */
export async function GET(req: NextRequest) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const snap = await adminDb
    .collection(`notifications/${session.uid}/items`)
    .where("read", "==", false)
    .limit(20)
    .get();

  const items = snap.docs
    .map((doc) => doc.data())
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });

  const body = await req.json().catch(() => null) as { ids?: string[] } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const batch = adminDb.batch();
  for (const id of ids.slice(0, 50)) {
    const ref = adminDb.doc(`notifications/${session.uid}/items/${id}`);
    batch.update(ref, { read: true });
  }
  await batch.commit();

  return NextResponse.json({ ok: true });
}
