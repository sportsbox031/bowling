import type { Firestore } from "firebase-admin/firestore";
import type { ApprovalAction } from "@/lib/models-user";

type AuditInput = Omit<ApprovalAction, "id" | "createdAt">;

/**
 * 관리자 감사 로그를 Firestore `approvalLogs` 컬렉션에 기록합니다.
 * 실패해도 메인 작업에 영향을 주지 않도록 에러를 삼킵니다.
 */
export async function writeAuditLog(db: Firestore, input: AuditInput): Promise<void> {
  try {
    const ref = db.collection("approvalLogs").doc();
    const log: ApprovalAction = {
      ...input,
      id: ref.id,
      createdAt: new Date().toISOString(),
    };
    await ref.set(log);
  } catch (err) {
    console.error("[audit] 감사 로그 기록 실패", err);
  }
}
