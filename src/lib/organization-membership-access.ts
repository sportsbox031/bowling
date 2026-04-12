import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";

export const hasApprovedOrganizationAccess = async (
  db: Firestore,
  uid: string,
  organizationId: string,
): Promise<boolean> => {
  const membershipId = `${uid}_${organizationId}`;
  const membershipSnap = await db.doc(firestorePaths.organizationMembership(membershipId)).get();
  return membershipSnap.exists && String(membershipSnap.data()?.status ?? "") === "APPROVED";
};
