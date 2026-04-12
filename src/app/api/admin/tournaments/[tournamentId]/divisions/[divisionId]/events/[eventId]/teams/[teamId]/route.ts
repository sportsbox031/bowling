import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";

type Ctx = { params: { tournamentId: string; divisionId: string; eventId: string; teamId: string } };

const getTeamRef = (
  tournamentId: string,
  divisionId: string,
  eventId: string,
  teamId: string,
) => {
  if (!adminDb) return null;
  return adminDb.doc(firestorePaths.team(tournamentId, divisionId, eventId, teamId));
};

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ message: "TEAM_EDIT_APPROVAL_FLOW_ONLY" }, { status: 409 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ message: "TEAM_EDIT_APPROVAL_FLOW_ONLY" }, { status: 409 });
}
