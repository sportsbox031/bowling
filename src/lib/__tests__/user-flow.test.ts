import {
  getTournamentFivesSubstitutionPrerequisite,
  getPostLoginRedirectPath,
  getPublicHeaderState,
  getTeamSubmissionPrerequisite,
  getTournamentTeamSubmissionPrerequisite,
} from "@/lib/user-flow";

describe("user flow helpers", () => {
  it("sends admins to admin after login", () => {
    expect(getPostLoginRedirectPath({
      adminSessionCreated: true,
      userApproved: true,
      next: "/tournaments/t-1?manage=1",
    })).toBe("/admin");
  });

  it("keeps approved users on a safe requested path", () => {
    expect(getPostLoginRedirectPath({
      adminSessionCreated: false,
      userApproved: true,
      next: "/tournaments/t-1?manage=1",
    })).toBe("/tournaments/t-1?manage=1");
  });

  it("falls back to the public home for unsafe next values", () => {
    expect(getPostLoginRedirectPath({
      adminSessionCreated: false,
      userApproved: true,
      next: "https://evil.example/path",
    })).toBe("/");
  });

  it("keeps non-admin users out of admin routes", () => {
    expect(getPostLoginRedirectPath({
      adminSessionCreated: false,
      userApproved: true,
      next: "/admin",
    })).toBe("/");
  });

  it("sends pending users to the pending screen", () => {
    expect(getPostLoginRedirectPath({
      adminSessionCreated: false,
      userApproved: false,
      next: "/tournaments/t-1?manage=1",
    })).toBe("/pending");
  });

  it("shows login only for logged-out visitors", () => {
    expect(getPublicHeaderState({
      authResolved: true,
      userSessionActive: false,
      adminSessionActive: false,
    })).toEqual({
      showLogin: true,
      showLogout: false,
      showSignup: true,
      dashboardHref: null,
      dashboardLabel: null,
      accountHref: null,
      accountLabel: null,
    });
  });

  it("shows logout and admin shortcut for admin sessions", () => {
    expect(getPublicHeaderState({
      authResolved: true,
      userSessionActive: false,
      adminSessionActive: true,
    })).toEqual({
      showLogin: false,
      showLogout: true,
      showSignup: false,
      dashboardHref: "/admin",
      dashboardLabel: "관리자",
      accountHref: null,
      accountLabel: null,
    });
  });

  it("shows account management for user sessions", () => {
    expect(getPublicHeaderState({
      authResolved: true,
      userSessionActive: true,
      adminSessionActive: false,
    })).toEqual({
      showLogin: false,
      showLogout: true,
      showSignup: false,
      dashboardHref: null,
      dashboardLabel: null,
      accountHref: "/account",
      accountLabel: "계정관리",
    });
  });

  it("marks divisions without player registration as blocked", () => {
    expect(getTeamSubmissionPrerequisite([], "division-a")).toEqual({
      status: "missing",
      message: "선수등록부터 진행해주세요.",
    });
  });

  it("marks submitted-but-not-approved player registrations as pending", () => {
    expect(getTeamSubmissionPrerequisite([
      { divisionId: "division-a", status: "SUBMITTED" },
    ], "division-a")).toEqual({
      status: "pending",
      message: "선수등록 승인 후 팀편성을 진행할 수 있습니다.",
    });
  });

  it("marks approved player registrations as ready", () => {
    expect(getTeamSubmissionPrerequisite([
      { divisionId: "division-a", status: "APPROVED" },
    ], "division-a")).toEqual({
      status: "ready",
      message: "",
    });
  });

  it("blocks tournament-level team submission when no player registration exists", () => {
    expect(getTournamentTeamSubmissionPrerequisite([])).toEqual({
      status: "missing",
      message: "선수등록부터 진행해주세요.",
    });
  });

  it("keeps tournament-level team submission pending until approval", () => {
    expect(getTournamentTeamSubmissionPrerequisite([
      { divisionId: "division-a", status: "SUBMITTED" },
    ])).toEqual({
      status: "pending",
      message: "선수등록 승인 후 팀편성을 진행할 수 있습니다.",
    });
  });

  it("enables tournament-level team submission after any approved player registration", () => {
    expect(getTournamentTeamSubmissionPrerequisite([
      { divisionId: "division-a", status: "SUBMITTED" },
      { divisionId: "division-b", status: "APPROVED" },
    ])).toEqual({
      status: "ready",
      message: "",
    });
  });

  it("blocks second-half substitution until a fives team is approved", () => {
    expect(getTournamentFivesSubstitutionPrerequisite()).toEqual({
      status: "missing",
      message: "5인조 팀편성 승인 후 후반 교체를 진행할 수 있습니다.",
      canOpenPage: false,
      canSubmit: false,
    });
  });

  it("opens the substitution page but keeps submission waiting until the admin opens the window", () => {
    expect(getTournamentFivesSubstitutionPrerequisite({
      approvedTeamCount: 2,
      readyCount: 0,
      submittedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    })).toEqual({
      status: "waiting",
      message: "관리자가 후반 교체 제출을 열면 진행할 수 있습니다.",
      canOpenPage: true,
      canSubmit: false,
    });
  });

  it("treats an open substitution window as ready", () => {
    expect(getTournamentFivesSubstitutionPrerequisite({
      approvedTeamCount: 1,
      readyCount: 1,
    })).toEqual({
      status: "ready",
      message: "",
      canOpenPage: true,
      canSubmit: true,
    });
  });
});
