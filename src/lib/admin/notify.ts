import type { Firestore } from "firebase-admin/firestore";
import type { UserNotification } from "@/lib/models-user";

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
