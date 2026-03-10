# Firebase Admin Vercel Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support Firebase Admin initialization from an environment JSON string so Vercel deployments can connect to Firestore without a local credential file.

**Architecture:** Extract credential parsing into a helper under `src/lib/firebase`, test it with a node script, and update `src/lib/firebase/admin.ts` to prefer JSON env input while preserving the local file-path fallback.

**Tech Stack:** Next.js App Router, Firebase Admin SDK, TypeScript, Node strip-types scripts

---

### Task 1: Add failing parser test

**Files:**
- Create: `scripts/firebase-admin-env.test.ts`

**Step 1: Write the failing test**
Assert that a helper can parse a raw JSON string and convert escaped `\\n` in `private_key` back to newline characters.

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types scripts/firebase-admin-env.test.ts`
Expected: FAIL with module not found or missing export.

### Task 2: Implement the parser helper

**Files:**
- Create: `src/lib/firebase/admin-credentials.ts`

**Step 1: Write minimal implementation**
Export a helper that reads `FIREBASE_SERVICE_ACCOUNT_JSON`, parses it, normalizes `private_key`, and returns a cert-ready object.

**Step 2: Run test to verify it passes**
Run: `node --experimental-strip-types scripts/firebase-admin-env.test.ts`
Expected: PASS

### Task 3: Update Firebase Admin initialization

**Files:**
- Modify: `src/lib/firebase/admin.ts`

**Step 1: Prefer JSON env**
Use `FIREBASE_SERVICE_ACCOUNT_JSON` first, then `FIREBASE_SERVICE_ACCOUNT_PATH`, then the existing project-id fallback.

**Step 2: Keep local compatibility**
Preserve path-based loading for local development.

### Task 4: Verify

**Files:**
- Test: `scripts/firebase-admin-env.test.ts`

**Step 1: Re-run parser test**
Run: `node --experimental-strip-types scripts/firebase-admin-env.test.ts`
Expected: PASS

**Step 2: Run production build**
Run: `npm run build`
Expected: successful production build
