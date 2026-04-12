import {
  buildFivesSubstitutionSubmission,
  isValidFivesSubstitution,
  normalizeFivesSubstitutionPayload,
} from "@/lib/submissions/fives-substitution";

describe("fives substitution submission helpers", () => {
  it("normalizes unique roster and lineup ids", () => {
    const payload = normalizeFivesSubstitutionPayload({
      rosterIds: ["p1", "p1", "p2", ""],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5", "p5"],
      secondHalfMemberIds: ["p2", "p3", "p4", "p5", "p6"],
    });

    expect(payload).toEqual({
      rosterIds: ["p1", "p2"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p2", "p3", "p4", "p5", "p6"],
    });
  });

  it("accepts valid roster and second-half lineup inside the roster", () => {
    expect(isValidFivesSubstitution({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
    })).toBe(true);
  });

  it("rejects lineups that include players outside the roster", () => {
    expect(isValidFivesSubstitution({
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p7"],
    })).toBe(false);
  });

  it("builds a submitted fives substitution record", () => {
    const submission = buildFivesSubstitutionSubmission("sub-1", {
      tournamentId: "t-1",
      divisionId: "d-1",
      eventId: "e-1",
      organizationId: "o-1",
      coachUid: "u-1",
      teamId: "team-1",
      teamEntrySubmissionId: "team-sub-1",
      rosterIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      firstHalfMemberIds: ["p1", "p2", "p3", "p4", "p5"],
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
    }, "2026-04-11T00:00:00.000Z");

    expect(submission).toMatchObject({
      id: "sub-1",
      teamId: "team-1",
      status: "SUBMITTED",
      secondHalfMemberIds: ["p1", "p2", "p3", "p4", "p6"],
    });
  });
});
