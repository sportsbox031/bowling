import type { Firestore } from "firebase-admin/firestore";
import type { UserNotification } from "@/lib/models-user";
import { firestorePaths } from "@/lib/firebase/schema";

type NotifyInput = Omit<UserNotification, "id" | "read" | "createdAt">;

/**
 * 사용자에게 in-app 알림을 생성합니다.
 * notifications/{uid}/items/{notificationId} 경로에 저장합니다.
 * 실패해도 메인 작업에 영향을 주지 않도록 에러를 삼킵니다.
 */
export async function createNotification(db: Firestore, input: NotifyInput): Promise<void> {
  try {
    const ref = db.collection(`notifications/${input.uid}/items`).doc();
    const notification: UserNotification = {
      ...input,
      id: ref.id,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await ref.set(notification);
  } catch (err) {
    console.error("[notify] 알림 생성 실패", err);
  }
}

/**
 * 대회명 + 종별명 + 종목명을 조회해 "[대회명] 종별 · 종목" 형태의 컨텍스트 문자열을 반환합니다.
 * 조회 실패 시 빈 문자열을 반환합니다.
 */
export async function resolveSubmissionContext(
  db: Firestore,
  tournamentId: string,
  divisionId: string,
  eventId?: string,
): Promise<string> {
  try {
    const fetches: Promise<FirebaseFirestore.DocumentSnapshot>[] = [
      db.doc(firestorePaths.tournament(tournamentId)).get(),
      db.doc(firestorePaths.division(tournamentId, divisionId)).get(),
    ];
    if (eventId) {
      fetches.push(db.doc(firestorePaths.event(tournamentId, divisionId, eventId)).get());
    }
    const snaps = await Promise.all(fetches);
    const tournamentTitle = String(snaps[0].data()?.title ?? "");
    const divisionTitle = String(snaps[1].data()?.title ?? "");
    const eventTitle = eventId ? String(snaps[2]?.data()?.title ?? "") : "";

    const parts = [divisionTitle, eventTitle].filter(Boolean).join(" · ");
    return tournamentTitle ? `[${tournamentTitle}]${parts ? ` ${parts}` : ""}` : parts;
  } catch {
    return "";
  }
}
