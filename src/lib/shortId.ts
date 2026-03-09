import type { Firestore } from "firebase-admin/firestore";

/**
 * shortId 생성 및 글로벌 선수 레지스트리 관리
 *
 * - shortId 형식: "P0001", "P0002", ...
 * - Firestore 트랜잭션으로 원자적 카운터 증가
 * - name + affiliation + region 조합으로 동일인 판별
 */

const COUNTER_DOC = "system/shortIdCounter";
const GLOBAL_PLAYERS = "globalPlayers";

export function formatShortId(num: number): string {
  return `P${String(num).padStart(4, "0")}`;
}

/** 원자적 카운터 증가 → 새 shortId 반환 */
async function getNextShortId(db: Firestore): Promise<string> {
  const counterRef = db.doc(COUNTER_DOC);
  const newId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists ? (snap.data()?.lastId ?? 0) : 0;
    const next = last + 1;
    tx.set(counterRef, { lastId: next }, { merge: true });
    return next;
  });
  return formatShortId(newId);
}

/**
 * 글로벌 선수 레지스트리에서 동일인 검색 또는 신규 등록
 * name + affiliation + region 이 모두 일치하면 동일인으로 판단
 */
export async function findOrCreateGlobalPlayer(
  db: Firestore,
  input: { name: string; affiliation: string; region: string },
): Promise<string> {
  const { name, affiliation, region } = input;

  // 기존 글로벌 선수 검색
  const snap = await db
    .collection(GLOBAL_PLAYERS)
    .where("name", "==", name)
    .where("affiliation", "==", affiliation)
    .where("region", "==", region)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].data().shortId as string;
  }

  // 신규 등록
  const shortId = await getNextShortId(db);
  await db
    .collection(GLOBAL_PLAYERS)
    .doc(shortId)
    .set({
      shortId,
      name,
      affiliation,
      region,
      createdAt: new Date().toISOString(),
    });

  return shortId;
}
