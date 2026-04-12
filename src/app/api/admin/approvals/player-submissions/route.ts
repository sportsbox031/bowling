import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";

type SubmissionRecord = {
  id: string;
  createdAt?: string;
  coachUid?: string;
  organizationId?: string;
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const searchParams = new URL(req.url).searchParams;
  const tournamentId = searchParams.get("tournamentId");
  const divisionId = searchParams.get("divisionId");
  if (!tournamentId) {
    return NextResponse.json({ message: "TOURNAMENT_ID_REQUIRED" }, { status: 400 });
  }

  let query = db
    .collection(firestorePaths.playerRegistrationSubmissions(tournamentId))
    .where("status", "==", "SUBMITTED");

  if (divisionId) {
    query = query.where("divisionId", "==", divisionId);
  }

  const snap = await query.get();

  const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as SubmissionRecord[];
  items.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  const coachUids = [...new Set(items.map((item) => String(item.coachUid ?? "").trim()).filter(Boolean))];
  const organizationIds = [...new Set(items.map((item) => String(item.organizationId ?? "").trim()).filter(Boolean))];

  const [coachSnaps, organizationSnaps] = await Promise.all([
    Promise.all(coachUids.map((uid) => db.doc(firestorePaths.user(uid)).get())),
    Promise.all(organizationIds.map((organizationId) => db.doc(firestorePaths.organization(organizationId)).get())),
  ]);

  const coachNameByUid = new Map(
    coachSnaps
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, String(doc.data()?.name ?? "")]),
  );
  const organizationNameById = new Map(
    organizationSnaps
      .filter((doc) => doc.exists)
      .map((doc) => [doc.id, String(doc.data()?.name ?? "")]),
  );

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      coachName: coachNameByUid.get(String(item.coachUid ?? "")) ?? "",
      organizationName: organizationNameById.get(String(item.organizationId ?? "")) ?? "",
    })),
  });
}
