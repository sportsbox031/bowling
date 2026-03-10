import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { parseServiceAccountJson } from "@/lib/firebase/admin-credentials";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!admin.apps.length) {
  if (serviceAccountJson) {
    const serviceAccount = parseServiceAccountJson(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId,
      storageBucket,
    });
  } else if (serviceAccountPath) {
    const absolutePath = path.resolve(serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, "utf-8");
    const serviceAccount = parseServiceAccountJson(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId,
      storageBucket,
    });
  } else if (projectId) {
    admin.initializeApp({
      projectId,
      storageBucket,
    });
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
