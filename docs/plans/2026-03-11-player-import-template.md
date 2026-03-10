# Player Import Template Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a downloadable player import template to the bulk registration panel so admins can fill the exact upload format.

**Architecture:** Extract template workbook creation into a small helper under `src/lib/admin`, test that helper with a node script, then wire a download button into the existing bulk import panel. Keep the upload parser and API contract unchanged.

**Tech Stack:** Next.js App Router, React, TypeScript, xlsx

---

### Task 1: Add failing template test

**Files:**
- Create: `scripts/player-import-template.test.ts`

**Step 1: Write the failing test**
Import a not-yet-existing workbook builder and assert that the first row is `group, region, affiliation, name, hand`.

**Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types scripts/player-import-template.test.ts`
Expected: FAIL with module not found or missing export.

### Task 2: Implement the workbook builder

**Files:**
- Create: `src/lib/admin/player-import-template.ts`

**Step 1: Write minimal implementation**
Export a helper that builds an `.xlsx` workbook containing one sheet with the required header and sample rows.

**Step 2: Run test to verify it passes**
Run: `node --experimental-strip-types scripts/player-import-template.test.ts`
Expected: PASS

### Task 3: Wire the download button into the panel

**Files:**
- Modify: `src/components/admin/PlayerBulkImportPanel.tsx`

**Step 1: Add a download action**
Add a `양식 다운로드` button beside the existing file picker and register button.

**Step 2: Improve guidance text**
Change the copy to a simple three-step flow: download template, fill rows, upload file.

### Task 4: Verify

**Files:**
- Test: `scripts/player-import-template.test.ts`

**Step 1: Re-run the template test**
Run: `node --experimental-strip-types scripts/player-import-template.test.ts`
Expected: PASS

**Step 2: Run the production build**
Run: `npm run build`
Expected: successful production build
