type PostLoginRedirectArgs = {
  adminSessionCreated: boolean;
  userApproved: boolean;
  next?: string | null;
};

type PublicHeaderStateArgs = {
  authResolved: boolean;
  userSessionActive: boolean;
  adminSessionActive: boolean;
};

type SubmissionLike = {
  divisionId?: string | null;
  status?: string | null;
};

type TeamSubmissionPrerequisite = {
  status: "ready" | "pending" | "missing";
  message: string;
};

type TournamentTeamSubmissionPrerequisite = {
  status: "ready" | "pending" | "missing";
  message: string;
};

type FivesSubstitutionSummary = {
  approvedTeamCount?: number | null;
  readyCount?: number | null;
  submittedCount?: number | null;
  approvedCount?: number | null;
  rejectedCount?: number | null;
};

type TournamentFivesSubstitutionPrerequisite = {
  status: "missing" | "waiting" | "ready" | "submitted";
  message: string;
  canOpenPage: boolean;
  canSubmit: boolean;
};

const getSafeNextPath = (next?: string | null): string => {
  const candidate = String(next ?? "").trim();
  if (!candidate.startsWith("/")) {
    return "/";
  }
  if (candidate.startsWith("//")) {
    return "/";
  }
  return candidate || "/";
};

export const getPostLoginRedirectPath = ({ adminSessionCreated, userApproved, next }: PostLoginRedirectArgs): string => {
  if (adminSessionCreated) {
    return "/admin";
  }

  if (!userApproved) {
    return "/pending";
  }

  const safeNextPath = getSafeNextPath(next);
  if (safeNextPath.startsWith("/admin")) {
    return "/";
  }

  return safeNextPath;
};

export const getPublicHeaderState = ({ authResolved, userSessionActive, adminSessionActive }: PublicHeaderStateArgs) => {
  if (!authResolved) {
    return {
      showLogin: false,
      showLogout: false,
      showSignup: false,
      dashboardHref: null,
      dashboardLabel: null,
      accountHref: null,
      accountLabel: null,
    };
  }

  if (adminSessionActive) {
    return {
      showLogin: false,
      showLogout: true,
      showSignup: false,
      dashboardHref: "/admin",
      dashboardLabel: "관리자",
      accountHref: null,
      accountLabel: null,
    };
  }

  if (userSessionActive) {
    return {
      showLogin: false,
      showLogout: true,
      showSignup: false,
      dashboardHref: null,
      dashboardLabel: null,
      accountHref: "/account",
      accountLabel: "계정관리",
    };
  }

  return {
    showLogin: true,
    showLogout: false,
    showSignup: true,
    dashboardHref: null,
    dashboardLabel: null,
    accountHref: null,
    accountLabel: null,
  };
};

export const getTeamSubmissionPrerequisite = (
  submissions: SubmissionLike[],
  divisionId: string,
): TeamSubmissionPrerequisite => {
  const divisionSubmissions = submissions.filter((submission) => String(submission.divisionId ?? "") === divisionId);

  if (divisionSubmissions.some((submission) => String(submission.status ?? "") === "APPROVED")) {
    return { status: "ready", message: "" };
  }

  if (divisionSubmissions.some((submission) => ["SUBMITTED", "PENDING", "UNDER_REVIEW"].includes(String(submission.status ?? "")))) {
    return { status: "pending", message: "선수등록 승인 후 팀편성을 진행할 수 있습니다." };
  }

  return { status: "missing", message: "선수등록부터 진행해주세요." };
};

export const getTournamentTeamSubmissionPrerequisite = (
  submissions: SubmissionLike[],
): TournamentTeamSubmissionPrerequisite => {
  if (submissions.some((submission) => String(submission.status ?? "") === "APPROVED")) {
    return { status: "ready", message: "" };
  }

  if (submissions.some((submission) => ["SUBMITTED", "PENDING", "UNDER_REVIEW"].includes(String(submission.status ?? "")))) {
    return { status: "pending", message: "선수등록 승인 후 팀편성을 진행할 수 있습니다." };
  }

  return { status: "missing", message: "선수등록부터 진행해주세요." };
};

export const getTournamentFivesSubstitutionPrerequisite = (
  summary?: FivesSubstitutionSummary | null,
): TournamentFivesSubstitutionPrerequisite => {
  const approvedTeamCount = Number(summary?.approvedTeamCount ?? 0);
  const readyCount = Number(summary?.readyCount ?? 0);
  const submittedCount = Number(summary?.submittedCount ?? 0);
  const approvedCount = Number(summary?.approvedCount ?? 0);
  const rejectedCount = Number(summary?.rejectedCount ?? 0);

  if (approvedTeamCount <= 0) {
    return {
      status: "missing",
      message: "5인조 팀편성 승인 후 후반 교체를 진행할 수 있습니다.",
      canOpenPage: false,
      canSubmit: false,
    };
  }

  if (readyCount > 0) {
    return {
      status: "ready",
      message: "",
      canOpenPage: true,
      canSubmit: true,
    };
  }

  if (submittedCount > 0 || approvedCount > 0 || rejectedCount > 0) {
    return {
      status: "submitted",
      message: "",
      canOpenPage: true,
      canSubmit: false,
    };
  }

  return {
    status: "waiting",
    message: "관리자가 후반 교체 제출을 열면 진행할 수 있습니다.",
    canOpenPage: true,
    canSubmit: false,
  };
};
