import type { Firestore } from "firebase-admin/firestore";
import { firestorePaths } from "@/lib/firebase/schema";

export const getApprovedOrganizationIdsForUser = async (db: Firestore, uid: string) => {
  const membershipsSnap = await db
    .collection(firestorePaths.organizationMemberships())
    .where("uid", "==", uid)
    .where("status", "==", "APPROVED")
    .get();

  return new Set(
    membershipsSnap.docs
      .map((doc) => String(doc.data()?.organizationId ?? "").trim())
      .filter(Boolean),
  );
};
