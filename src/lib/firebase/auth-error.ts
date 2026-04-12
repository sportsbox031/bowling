type AuthErrorLike = {
  code?: string;
  message?: string;
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "이미 가입된 메일주소입니다. 로그인하거나 다른 메일주소를 사용해 주세요.",
  "auth/invalid-email": "메일주소 형식이 올바르지 않습니다.",
  "auth/missing-password": "비밀번호를 입력해 주세요.",
  "auth/weak-password": "비밀번호가 너무 약합니다. 6자 이상으로 입력해 주세요.",
  "auth/invalid-credential": "메일주소 또는 비밀번호가 올바르지 않습니다.",
  "auth/user-not-found": "가입된 계정을 찾지 못했습니다.",
  "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
  "auth/too-many-requests": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  "auth/network-request-failed": "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  "auth/operation-not-allowed": "현재 이메일/비밀번호 회원가입이 Firebase 인증 설정에서 비활성화되어 있습니다.",
};

export const getFirebaseAuthErrorMessage = (error: unknown, fallback: string): string => {
  const candidate = error as AuthErrorLike | null;
  const code = String(candidate?.code ?? "").trim();
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  const message = String(candidate?.message ?? "").trim();
  if (message) {
    return `${fallback} (${message})`;
  }

  return fallback;
};
