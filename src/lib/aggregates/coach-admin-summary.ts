import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";

export type CoachAdminSummaryRow = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  organizationCount: number;
  representativeOrganizationName: string | null;
  pendingOrganizationCount: number;
  pendingOrganizationNames: string[];
  pendingRemovalCount: number;
  pendingRemovalNames: string[];
  createdAt: string;
  updatedAt: string;
};

export type CoachAdminSummaryPayload = {
  rows: CoachAdminSummaryRow[];
  updatedAt: string;
};

const getAggregateRef = (db: Firestore) => db.doc("system/adminCoachSummary");

export async function computeCoachAdminSummary(db: Firestore): Promise<CoachAdminSummaryPayload> {
  const [usersSnap, membershipsSnap, organizationsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("organizationMemberships").get(),
    db.collection("organizations").get(),
  ]);

  const organizationNameById = new Map<string, string>();
  organizationsSnap.docs.forEach((doc) => {
    const data = doc.data() ?? {};
    organizationNameById.set(doc.id, String(data.name ?? ""));
  });

  const approvedMembershipsByUser = new Map<string, string[]>();
  const pendingMembershipsByUser = new Map<string, string[]>();
  const pendingRemovalMembershipsByUser = new Map<string, string[]>();
  membershipsSnap.docs.forEach((doc) => {
    const data = doc.data() ?? {};
    const uid = String(data.uid ?? "");
    if (!uid) return;
    const organizationId = String(data.organizationId ?? "");
    if (!organizationId) return;
    const membershipStatus = String(data.status ?? "");

    if (membershipStatus === "APPROVED") {
      const current = approvedMembershipsByUser.get(uid) ?? [];
      current.push(organizationId);
      approvedMembershipsByUser.set(uid, current);
      if (typeof data.removalRequestedAt === "string" && data.removalRequestedAt.trim()) {
        const removalCurrent = pendingRemovalMembershipsByUser.get(uid) ?? [];
        removalCurrent.push(organizationId);
        pendingRemovalMembershipsByUser.set(uid, removalCurrent);
      }
      return;
    }

    if (membershipStatus === "PENDING_APPROVAL") {
      const current = pendingMembershipsByUser.get(uid) ?? [];
      current.push(organizationId);
      pendingMembershipsByUser.set(uid, current);
    }
  });

  const rows = usersSnap.docs.map((doc) => {
    const data = doc.data() ?? {};
    const approvedOrganizationIds = [...new Set(approvedMembershipsByUser.get(doc.id) ?? [])];
    const pendingOrganizationIds = [...new Set(pendingMembershipsByUser.get(doc.id) ?? [])];
    const pendingRemovalIds = [...new Set(pendingRemovalMembershipsByUser.get(doc.id) ?? [])];
    const representativeOrganizationName = approvedOrganizationIds.length > 0
      ? organizationNameById.get(approvedOrganizationIds[0]!) ?? null
      : null;
    const pendingOrganizationNames = pendingOrganizationIds
      .map((organizationId) => organizationNameById.get(organizationId) ?? "")
      .filter(Boolean);
    const pendingRemovalNames = pendingRemovalIds
      .map((organizationId) => organizationNameById.get(organizationId) ?? "")
      .filter(Boolean);

    return {
      uid: doc.id,
      name: String(data.name ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      status: String(data.status ?? "PENDING_APPROVAL"),
      organizationCount: approvedOrganizationIds.length,
      representativeOrganizationName,
      pendingOrganizationCount: pendingOrganizationIds.length,
      pendingOrganizationNames,
      pendingRemovalCount: pendingRemovalIds.length,
      pendingRemovalNames,
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    } satisfies CoachAdminSummaryRow;
  }).sort((a, b) =>
    b.pendingRemovalCount - a.pendingRemovalCount ||
    b.pendingOrganizationCount - a.pendingOrganizationCount ||
    a.status.localeCompare(b.status) ||
    a.name.localeCompare(b.name, "ko") ||
    a.email.localeCompare(b.email),
  );

  return {
    rows,
    updatedAt: new Date().toISOString(),
  };
}

export async function rebuildCoachAdminSummary(db: Firestore): Promise<CoachAdminSummaryPayload> {
  const payload = await computeCoachAdminSummary(db);
  await getAggregateRef(db).set(payload);
  return payload;
}

export async function readCoachAdminSummary(db: Firestore): Promise<CoachAdminSummaryPayload | null> {
  const snap = await getAggregateRef(db).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    rows: Array.isArray(data.rows) ? data.rows as CoachAdminSummaryRow[] : [],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}
