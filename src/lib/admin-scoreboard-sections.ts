export type ScoreboardSection = "setup" | "scores" | "teams";

export type LoadedScoreboardSections = Record<ScoreboardSection, boolean>;

export const createLoadedScoreboardSections = (): LoadedScoreboardSections => ({
  setup: false,
  scores: false,
  teams: false,
});

export const markSectionLoaded = (
  sections: LoadedScoreboardSections,
  section: ScoreboardSection,
): LoadedScoreboardSections => ({
  ...sections,
  [section]: true,
});

export const markSectionStale = (
  sections: LoadedScoreboardSections,
  section: ScoreboardSection,
): LoadedScoreboardSections => ({
  ...sections,
  [section]: false,
});

export const needsSectionLoad = (
  sections: LoadedScoreboardSections,
  section: ScoreboardSection,
): boolean => !sections[section];
