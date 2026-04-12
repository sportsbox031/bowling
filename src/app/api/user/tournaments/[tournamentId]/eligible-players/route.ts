import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE, resolveUserSession } from "@/lib/auth/user-session";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { hasApprovedOrganizationAccess } from "@/lib/organization-membership-access";

type Ctx = { params: { tournamentId: string } };
type PlayerRecord = {
  id: string;
  divisionId?: string;
  organizationId?: string;
  number?: number;
  [key: string]: unknown;
};

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!session.isApproved) return NextResponse.json({ message: "FORBIDDEN" }, { status: 403 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const query = new URL(req.url).searchParams;
  const divisionId = String(query.get("divisionId") ?? "").trim();
  const organizationId = String(query.get("organizationId") ?? "").trim();

  if (!divisionId || !organizationId) {
    return NextResponse.json({ message: "INVALID_QUERY" }, { status: 400 });
  }

  if (!(await hasApprovedOrganizationAccess(db, session.uid, organizationId))) {
    return NextResponse.json({ message: "ORGANIZATION_FORBIDDEN" }, { status: 403 });
  }

  const playersSnap = await db
    .collection(firestorePaths.players(ctx.params.tournamentId))
    .where("organizationId", "==", organizationId)
    .get();
  const items = playersSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as PlayerRecord)
    .filter((item) =>
      String(item.divisionId ?? "") === divisionId &&
      String(item.organizationId ?? "") === organizationId,
    )
    .sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0));

  return NextResponse.json({ items });
}
