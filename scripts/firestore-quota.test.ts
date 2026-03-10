import assert from "node:assert/strict";
import {
  getQuotaExceededMessage,
  isFirestoreQuotaExceededError,
} from "../src/lib/firebase/quota.ts";

assert.equal(
  isFirestoreQuotaExceededError({ code: 8, message: "8 RESOURCE_EXHAUSTED: Quota exceeded." }),
  true,
);
assert.equal(
  isFirestoreQuotaExceededError(new Error("Quota exceeded.")),
  true,
);
assert.equal(
  isFirestoreQuotaExceededError(new Error("Permission denied")),
  false,
);
assert.equal(
  getQuotaExceededMessage("대회 정보를 불러오는 중"),
  "대회 정보를 불러오는 요청이 많아 잠시 후 다시 시도해 주세요.",
);

console.log("firestore quota test passed");
