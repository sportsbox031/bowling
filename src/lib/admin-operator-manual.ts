export type ManualStep = {
  title: string;
  description: string;
};

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  steps: ManualStep[];
};

export const adminQuickStart: ManualStep[] = [
  {
    title: "대회와 종별 선택",
    description: "관리자 로그인 후 대회를 열고, 운영할 종별을 먼저 선택합니다.",
  },
  {
    title: "선수 등록",
    description: "선수 등록 탭에서 개별 입력 또는 일괄 업로드로 선수 명단을 준비합니다.",
  },
  {
    title: "세부종목 열기",
    description: "세부종목 관리 표에서 종목명을 눌러 운영 화면으로 들어갑니다.",
  },
  {
    title: "출전선수와 레인 배정",
    description: "개인전은 승인된 선수 전원이 자동 참가하고, 팀전은 승인된 팀편성 기준으로 스쿼드와 레인을 정리합니다.",
  },
  {
    title: "점수 입력과 순위 반영",
    description: "점수 입력을 마친 뒤 순위 반영 버튼을 눌러 최신 순위를 계산합니다.",
  },
];

export const adminManualSections: ManualSection[] = [
  {
    id: "setup",
    title: "대회 준비",
    summary: "운영 시작 전 반드시 확인해야 하는 기본 준비 절차입니다.",
    steps: [
      {
        title: "종별 생성",
        description: "대회 상세에서 종별을 추가하고, 실제 경기 구분과 같은 이름으로 맞춥니다.",
      },
      {
        title: "세부종목 생성",
        description: "경기일, 게임 수, 레인 범위, table 이동값을 확인하며 종목을 등록합니다.",
      },
      {
        title: "선수 명단 입력",
        description: "선수 등록 화면에서 번호, 이름, 소속, 시군, 팀조를 확인한 뒤 저장합니다.",
      },
    ],
  },
  {
    id: "lane",
    title: "레인 운영",
    summary: "실제 경기 직전 레인과 출전 상태를 정리하는 절차입니다.",
    steps: [
      {
        title: "참가선수 확인",
        description: "개인전은 자동 참가 선수와 스쿼드만 확인하고, 팀전은 승인된 팀편성 기준으로 출전 선수를 확인합니다.",
      },
      {
        title: "레인 배정",
        description: "드래그앤드롭으로 레인에 배정하고, 같은 레인 안에서는 순서도 조정할 수 있습니다.",
      },
      {
        title: "수동 저장",
        description: "배정을 바꾼 뒤에는 반드시 수동 저장 또는 랜덤 배정 저장으로 확정합니다.",
      },
    ],
  },
  {
    id: "score",
    title: "점수 입력",
    summary: "게임 진행 중 가장 자주 보는 핵심 운영 절차입니다.",
    steps: [
      {
        title: "게임 선택",
        description: "현재 입력할 게임 번호와 레인을 확인한 뒤 점수를 입력합니다.",
      },
      {
        title: "개별 저장 또는 레인 전체 저장",
        description: "점수는 선수별 저장도 가능하고, 레인 전체 저장으로 한 번에 저장할 수도 있습니다.",
      },
      {
        title: "순위 반영",
        description: "한 게임 입력이 끝난 뒤 순위 반영을 눌러 세부순위와 종합순위를 갱신합니다.",
      },
    ],
  },
  {
    id: "trouble",
    title: "자주 발생하는 상황",
    summary: "운영 중 자주 헷갈리는 사례와 권장 대응입니다.",
    steps: [
      {
        title: "순위가 바로 안 바뀌는 경우",
        description: "점수 저장만으로는 순위가 갱신되지 않으므로 순위 반영 버튼을 눌러야 합니다.",
      },
      {
        title: "레인 순서가 달라진 경우",
        description: "같은 레인 안에서 순서를 바꿨다면 저장을 다시 눌러야 다음 진입 때 유지됩니다.",
      },
      {
        title: "잘못 입력한 점수 수정",
        description: "같은 선수 점수를 다시 입력하고 저장하면 최신 값으로 덮어씁니다.",
      },
    ],
  },
];
