import assert from "node:assert/strict";
import { parseServiceAccountJson } from "../src/lib/firebase/admin-credentials.ts";

const parsed = parseServiceAccountJson(JSON.stringify({
  project_id: "demo-project",
  client_email: "firebase-adminsdk@example.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n",
}));

assert.equal(parsed.project_id, "demo-project");
assert.equal(parsed.client_email, "firebase-adminsdk@example.com");
assert.ok(parsed.private_key.includes("\nabc123\n"));
assert.ok(!parsed.private_key.includes("\\n"));

console.log("firebase-admin env test passed");
