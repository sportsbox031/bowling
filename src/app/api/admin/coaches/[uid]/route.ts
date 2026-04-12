import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, firestorePaths } from "@/lib/firebase/schema";
import { rebuildCoachAdminSummary } from "@/lib/aggregates/coach-admin-summary";
import { invalidateCache } from "@/lib/api-cache";
import { buildOrganizationRecord, normalizeOrganizationName } from "@/lib/organizations";

type Ctx = { params: { uid: string } };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const uid = ctx.params.uid;
  const userSnap = await db.doc(firestorePaths.user(uid)).get();
  if (!userSnap.exists) {
    return NextResponse.json({ message: "USER_NOT_FOUND" }, { status: 404 });
  }

  const membershipsSnap = await db.collection("organizationMemberships").where("uid", "==", uid).get();
  const organizationIds = membershipsSnap.docs.map((doc) => String(doc.data().organizationId ?? "")).filter(Boolean);
  const organizationSnaps = await Promise.all(organizationIds.map((organizationId) => db.doc(firestorePaths.organization(organizationId)).get()));

  return NextResponse.json({
    profile: { uid, ...userSnap.data() },
    memberships: membershipsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    organizations: organizationSnaps.filter((doc) => doc.exists).map((doc) => ({ id: doc.id, ...doc.data() })),
  });
}

const countMembershipsForOrganization = async (organizationId: string) => {
  if (!adminDb) return 0;
  const snap = await adminDb
    .collection(firestorePaths.organizationMemberships())
    .where("organizationId", "==", organizationId)
    .limit(2)
    .get();
  return snap.size;
};

const deleteCoachSubmissionHistory = async (uid: string, organizationId: string) => {
  if (!adminDb || !uid || !organizationId) return;

  const tournamentsSnap = await adminDb.collection(COLLECTIONS.Tournaments).get();
  const deleteTargets: FirebaseFirestore.DocumentReference[] = [];

  for (const tournamentDoc of tournamentsSnap.docs) {
    const tournamentId = tournamentDoc.id;

    const [playerSubmissionSnap, teamSubmissionSnap] = await Promise.all([
      adminDb
        .collection(firestorePaths.playerRegistrationSubmissions(tournamentId))
        .where("coachUid", "==", uid)
        .where("organizationId", "==", organizationId)
        .get(),
      adminDb
        .collection(firestorePaths.teamEntrySubmissions(tournamentId))
        .where("coachUid", "==", uid)
        .where("organizationId", "==", organizationId)
        .get(),
    ]);

    deleteTargets.push(...playerSubmissionSnap.docs.map((doc) => doc.ref));
    deleteTargets.push(...teamSubmissionSnap.docs.map((doc) => doc.ref));
  }

  for (let index = 0; index < deleteTargets.length; index += 400) {
    const batch = adminDb.batch();
    for (const ref of deleteTargets.slice(index, index + 400)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
};

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const uid = ctx.params.uid;
  const userRef = db.doc(firestorePaths.user(uid));
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ message: "USER_NOT_FOUND" }, { status: 404 });
  }
  const body = await req.json().catch(() => null) as {
    primaryOrganizationId?: string;
    addOrganizationNames?: string[];
    membershipAction?: { membershipId?: string; action?: "APPROVE" | "REJECT" | "APPROVE_REMOVAL" | "REJECT_REMOVAL" };
  } | null;
  const now = new Date().toISOString();
  const currentPrimaryOrganizationId = String(userSnap.data()?.primaryOrganizationId ?? "").trim();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (typeof body?.primaryOrganizationId === "string" && body.primaryOrganizationId.trim()) {
    updates.primaryOrganizationId = body.primaryOrganizationId.trim();
  }

  const normalizedNames = Array.isArray(body?.addOrganizationNames)
    ? [...new Set(body.addOrganizationNames.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : [];
  const batch = db.batch();

  for (const organizationName of normalizedNames) {
    const existingOrganizationSnap = await db
      .collection(firestorePaths.organizations())
      .where("normalizedName", "==", normalizeOrganizationName(organizationName))
      .limit(1)
      .get();
    const organizationRef = existingOrganizationSnap.empty
      ? db.collection(firestorePaths.organizations()).doc()
      : existingOrganizationSnap.docs[0].ref;

    if (existingOrganizationSnap.empty) {
      batch.set(organizationRef, buildOrganizationRecord({
        id: organizationRef.id,
        name: organizationName,
        createdBy: session.uid,
        now,
      }));
    }

    const membershipRef = db.doc(firestorePaths.organizationMembership(`${uid}_${organizationRef.id}`));
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      batch.set(membershipRef, {
        id: `${uid}_${organizationRef.id}`,
        uid,
        organizationId: organizationRef.id,
        role: "COACH",
        status: "PENDING_APPROVAL",
        createdAt: now,
        updatedAt: now,
        requestedBy: session.uid,
      });
    }
  }

  const membershipAction = body?.membershipAction;
  if (membershipAction?.membershipId && membershipAction.action) {
    const membershipRef = db.doc(firestorePaths.organizationMembership(membershipAction.membershipId));
    const membershipSnap = await membershipRef.get();
    if (membershipSnap.exists) {
      const nextStatus = membershipAction.action === "APPROVE"
        ? "APPROVED"
        : membershipAction.action === "REJECT"
          ? "REJECTED"
          : "APPROVED";
      const organizationId = String(membershipSnap.data()?.organizationId ?? "").trim();
      const removalRequestedAt = String(membershipSnap.data()?.removalRequestedAt ?? "").trim();
      if (membershipAction.action === "REJECT") {
        batch.delete(membershipRef);
        if (organizationId) {
          await deleteCoachSubmissionHistory(uid, organizationId);
          const organizationRef = db.doc(firestorePaths.organization(organizationId));
          const organizationSnap = await organizationRef.get();
          const organizationStatus = String(organizationSnap.data()?.status ?? "").trim();
          const membershipCount = await countMembershipsForOrganization(organizationId);
          if (organizationStatus === "PENDING" && membershipCount <= 1) {
            batch.delete(organizationRef);
          }
          if (currentPrimaryOrganizationId === organizationId) {
            updates.primaryOrganizationId = null;
          }
        }
      } else if (membershipAction.action === "APPROVE_REMOVAL") {
        batch.delete(membershipRef);
        if (organizationId) {
          await deleteCoachSubmissionHistory(uid, organizationId);
          if (currentPrimaryOrganizationId === organizationId) {
            updates.primaryOrganizationId = null;
          }
        }
      } else if (membershipAction.action === "REJECT_REMOVAL") {
        if (removalRequestedAt) {
          batch.set(membershipRef, {
            updatedAt: now,
            removalRequestedAt: null,
            removalRequestedBy: null,
          }, { merge: true });
        }
      } else {
        batch.set(membershipRef, {
          status: nextStatus,
          updatedAt: now,
          ...(membershipAction.action === "APPROVE"
            ? {
                approvedAt: now,
                approvedBy: session.uid,
                rejectedAt: null,
                rejectedBy: null,
                disabledAt: null,
                disabledBy: null,
                removalRequestedAt: null,
                removalRequestedBy: null,
              }
            : {}),
        }, { merge: true });

        if (organizationId && membershipAction.action === "APPROVE") {
          batch.set(db.doc(firestorePaths.organization(organizationId)), {
            status: "ACTIVE",
            updatedAt: now,
            approvedAt: now,
            approvedBy: session.uid,
          }, { merge: true });
        }
      }
    }
  }

  batch.set(userRef, updates, { merge: true });
  await batch.commit();
  invalidateCache("admin-coaches:");
  await rebuildCoachAdminSummary(db);
  return NextResponse.json({ ok: true });
}
