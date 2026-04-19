import type { QueryDocumentSnapshot, DocumentData, DocumentSnapshot } from "firebase-admin/firestore";

/**
 * Firestore 컬렉션 쿼리 스냅샷을 타입 안전한 객체로 변환합니다.
 * snap.docs.map(toDoc<MyType>) 형태로 사용합니다.
 */
export function toDoc<T extends DocumentData>(snap: QueryDocumentSnapshot): T & { id: string } {
  return { id: snap.id, ...(snap.data() as T) };
}

/**
 * 단일 문서 스냅샷(DocumentSnapshot)을 타입 안전한 객체로 변환합니다.
 * 문서가 존재하지 않으면 null을 반환합니다.
 */
export function snapToDoc<T extends DocumentData>(snap: DocumentSnapshot): (T & { id: string }) | null {
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as T) };
}
