import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth/admin";
import { adminDb } from "@/lib/firebase/admin";
import { getCached, invalidateCache, setCache } from "@/lib/api-cache";
import { readCoachAdminSummary, rebuildCoachAdminSummary } from "@/lib/aggregates/coach-admin-summary";
import { firestorePaths } from "@/lib/firebase/schema";

const CACHE_KEY = "admin-coaches:summary";
const SUMMARY_MAX_AGE_MS = 10 * 1000;

const isFreshSummary = (updatedAt?: string) => {
  if (!updatedAt) return false;
  const updatedTime = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedTime)) return false;
  return Date.now() - updatedTime <= SUMMARY_MAX_AGE_MS;
};

export async function GET(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const cached = getCached<object>(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  const storedSummary = await readCoachAdminSummary(db);
  const summary = storedSummary && isFreshSummary(storedSummary.updatedAt)
    ? storedSummary
    : await rebuildCoachAdminSummary(db);
  const result = { rows: summary.rows, updatedAt: summary.updatedAt };
  setCache(CACHE_KEY, result, 15000);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  if (!adminDb) return NextResponse.json({ message: "FIRESTORE_NOT_READY" }, { status: 503 });
  const db = adminDb;

  const body = await req.json().catch(() => null) as { uid?: string; action?: "APPROVE" | "REJECT" | "DISABLE" } | null;
  const uid = String(body?.uid ?? "").trim();
  const action = body?.action;
  if (!uid || !action) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const status = action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "DISABLED";
  const now = new Date().toISOString();
  const userRef = db.doc(firestorePaths.user(uid));
  const membershipsSnap = await db
    .collection(firestorePaths.organizationMemberships())
    .where("uid", "==", uid)
    .get();
  const batch = db.batch();

  batch.set(userRef, {
    status,
    updatedAt: now,
    ...(action === "APPROVE" ? { approvedAt: now, approvedBy: session.uid } : {}),
    ...(action === "REJECT" ? { rejectedAt: now, rejectedBy: session.uid } : {}),
    ...(action === "DISABLE" ? { disabledAt: now, disabledBy: session.uid } : {}),
  }, { merge: true });

  const organizationIds = new Set<string>();
  for (const membershipDoc of membershipsSnap.docs) {
    const membership = membershipDoc.data();
    const organizationId = String(membership.organizationId ?? "").trim();
    if (organizationId) {
      organizationIds.add(organizationId);
    }

    batch.set(membershipDoc.ref, {
      status,
      updatedAt: now,
      ...(action === "APPROVE" ? { approvedAt: now, approvedBy: session.uid, disabledAt: null, disabledBy: null, rejectedAt: null, rejectedBy: null } : {}),
      ...(action === "REJECT" ? { rejectedAt: now, rejectedBy: session.uid } : {}),
      ...(action === "DISABLE" ? { disabledAt: now, disabledBy: session.uid } : {}),
    }, { merge: true });
  }

  if (action === "APPROVE") {
    for (const organizationId of organizationIds) {
      batch.set(db.doc(firestorePaths.organization(organizationId)), {
        status: "ACTIVE",
        updatedAt: now,
        approvedAt: now,
        approvedBy: session.uid,
      }, { merge: true });
    }

    const userSnap = await userRef.get();
    if (userSnap.exists && !userSnap.data()?.primaryOrganizationId) {
      const firstOrganizationId = membershipsSnap.docs[0]?.data()?.organizationId;
      if (firstOrganizationId) {
        batch.set(userRef, { primaryOrganizationId: firstOrganizationId }, { merge: true });
      }
    }
  }

  await batch.commit();

  invalidateCache(CACHE_KEY);
  const summary = await rebuildCoachAdminSummary(db);
  return NextResponse.json({ ok: true, rows: summary.rows, updatedAt: summary.updatedAt });
}
