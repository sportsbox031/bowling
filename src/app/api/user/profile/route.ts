import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { firestorePaths } from "@/lib/firebase/schema";
import { rebuildCoachAdminSummary } from "@/lib/aggregates/coach-admin-summary";
import { invalidateCache } from "@/lib/api-cache";
import {
  USER_SESSION_COOKIE,
  readUserProfile,
  resolveUserSession,
  verifyUserSessionToken,
} from "@/lib/auth/user-session";
import { buildOrganizationRecord, normalizeOrganizationName } from "@/lib/organizations";

const ADMIN_COACHES_CACHE_KEY = "admin-coaches:summary";

type ProfilePayload = {
  name?: string;
  phone?: string;
  email?: string;
  privacyConsent?: boolean;
  organizationNames?: string[];
  removeOrganizationIds?: string[];
};

type MembershipRecord = {
  id: string;
  organizationId?: string;
  [key: string]: unknown;
};

type OrganizationRecord = {
  id: string;
  [key: string]: unknown;
};

const normalizeOrganizationNames = (raw: unknown): string[] => Array.isArray(raw)
  ? [...new Set(raw.map((value) => String(value ?? "").trim()).filter(Boolean))]
  : [];

const readMembershipBundle = async (uid: string) => {
  if (!adminDb) return { memberships: [], organizations: [] };
  const db = adminDb;

  const membershipsSnap = await db
    .collection(firestorePaths.organizationMemberships())
    .where("uid", "==", uid)
    .get();

  const memberships = membershipsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as MembershipRecord[];
  const organizationIds = [...new Set(
    memberships
      .map((membership) => String(membership.organizationId ?? "").trim())
      .filter(Boolean),
  )];

  const organizationSnaps = await Promise.all(
    organizationIds.map((organizationId) => db.doc(firestorePaths.organization(organizationId)).get()),
  );

  const organizations = organizationSnaps
    .filter((doc) => doc.exists)
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) })) as OrganizationRecord[];

  return { memberships, organizations };
};

const ensureOrganizationMemberships = async (uid: string, organizationNames: string[], now: string) => {
  if (!adminDb || organizationNames.length === 0) return;
  const db = adminDb;

  const batch = db.batch();

  for (const organizationName of organizationNames) {
    const normalizedName = normalizeOrganizationName(organizationName);
    const existingOrganizationSnap = await db
      .collection(firestorePaths.organizations())
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    const organizationRef = existingOrganizationSnap.empty
      ? db.collection(firestorePaths.organizations()).doc()
      : existingOrganizationSnap.docs[0].ref;

    if (existingOrganizationSnap.empty) {
      batch.set(
        organizationRef,
        buildOrganizationRecord({
          id: organizationRef.id,
          name: organizationName,
          createdBy: uid,
          now,
        }),
      );
    }

    const membershipId = `${uid}_${organizationRef.id}`;
    const membershipRef = db.doc(firestorePaths.organizationMembership(membershipId));
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      batch.set(membershipRef, {
        id: membershipId,
        uid,
        organizationId: organizationRef.id,
        role: "COACH",
        status: "PENDING_APPROVAL",
        createdAt: now,
        updatedAt: now,
        requestedBy: uid,
      });
    }
  }

  await batch.commit();
};

export async function GET(req: NextRequest) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "UNAUTHORIZED" }, { status: 401 });
  }

  const bundle = await readMembershipBundle(session.uid);
  return NextResponse.json({
    profile: session.profile,
    memberships: bundle.memberships,
    organizations: bundle.organizations,
  });
}

export async function POST(req: NextRequest) {
  const identity = await verifyUserSessionToken(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!identity || !adminDb) {
    return NextResponse.json({ message: identity ? "FIRESTORE_NOT_READY" : "UNAUTHORIZED" }, { status: identity ? 503 : 401 });
  }
  const db = adminDb;

  const existingProfile = await readUserProfile(identity.uid);
  if (existingProfile) {
    return NextResponse.json({ message: "PROFILE_ALREADY_EXISTS" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as ProfilePayload | null;
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? identity.email ?? "").trim();
  const privacyConsent = body?.privacyConsent === true;
  const organizationNames = normalizeOrganizationNames(body?.organizationNames);

  if (!name || !phone || !email || !privacyConsent || organizationNames.length === 0) {
    return NextResponse.json({ message: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const userRef = db.doc(firestorePaths.user(identity.uid));
  await ensureOrganizationMemberships(identity.uid, organizationNames, now);
  invalidateCache(ADMIN_COACHES_CACHE_KEY);
  await rebuildCoachAdminSummary(db);
  const membershipBundle = await readMembershipBundle(identity.uid);
  const primaryOrganizationId = membershipBundle.memberships[0]?.organizationId;

  await userRef.set({
    uid: identity.uid,
    email,
    name,
    phone,
    status: "PENDING_APPROVAL",
    privacyConsentAt: now,
    createdAt: now,
    updatedAt: now,
    ...(primaryOrganizationId ? { primaryOrganizationId } : {}),
  });

  return NextResponse.json({
    profile: {
      uid: identity.uid,
      email,
      name,
      phone,
      status: "PENDING_APPROVAL",
      privacyConsentAt: now,
      createdAt: now,
      updatedAt: now,
      ...(primaryOrganizationId ? { primaryOrganizationId } : {}),
    },
    memberships: membershipBundle.memberships,
    organizations: membershipBundle.organizations,
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await resolveUserSession(req.cookies.get(USER_SESSION_COOKIE)?.value);
  if (!session || !adminDb) {
    return NextResponse.json({ message: session ? "FIRESTORE_NOT_READY" : "UNAUTHORIZED" }, { status: session ? 503 : 401 });
  }
  const db = adminDb;

  const body = (await req.json().catch(() => null)) as ProfilePayload | null;
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body?.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body?.phone === "string" && body.phone.trim()) {
    updates.phone = body.phone.trim();
  }
  if (typeof body?.email === "string" && body.email.trim()) {
    updates.email = body.email.trim();
  }
  const organizationNames = normalizeOrganizationNames(body?.organizationNames);
  const removeOrganizationIds = Array.isArray(body?.removeOrganizationIds)
    ? [...new Set(body.removeOrganizationIds.map((value) => String(value ?? "").trim()).filter(Boolean))]
    : [];

  await db.doc(firestorePaths.user(session.uid)).set(updates, { merge: true });
  if (organizationNames.length > 0) {
    await ensureOrganizationMemberships(session.uid, organizationNames, updates.updatedAt as string);
    invalidateCache(ADMIN_COACHES_CACHE_KEY);
    await rebuildCoachAdminSummary(db);
  }
  if (removeOrganizationIds.length > 0) {
    const batch = db.batch();
    for (const organizationId of removeOrganizationIds) {
      const membershipRef = db.doc(firestorePaths.organizationMembership(`${session.uid}_${organizationId}`));
      const membershipSnap = await membershipRef.get();
      if (!membershipSnap.exists) {
        continue;
      }
      const membership = membershipSnap.data() ?? {};
      if (String(membership.status ?? "") !== "APPROVED") {
        continue;
      }
      batch.set(membershipRef, {
        updatedAt: updates.updatedAt,
        removalRequestedAt: updates.updatedAt,
        removalRequestedBy: session.uid,
      }, { merge: true });
    }
    await batch.commit();
    invalidateCache(ADMIN_COACHES_CACHE_KEY);
    await rebuildCoachAdminSummary(db);
  }
  const profile = await readUserProfile(session.uid);
  const bundle = await readMembershipBundle(session.uid);
  return NextResponse.json({
    profile,
    memberships: bundle.memberships,
    organizations: bundle.organizations,
  });
}
