type EventDisplayInput = {
  title?: string;
  kind?: string;
  halfType?: string | null;
};

const normalize = (value?: string | null) => (value ?? "").replace(/\s+/g, "").toUpperCase();

const inferKindOrder = (input: EventDisplayInput): number => {
  const kind = normalize(input.kind);
  const title = normalize(input.title);

  if (kind === "SINGLE" || title.includes("개인")) return 0;
  if (kind === "DOUBLES" || title.includes("2인")) return 1;
  if (kind === "TRIPLES" || title.includes("3인")) return 2;
  if (kind === "FOURS" || title.includes("4인")) return 3;
  if (kind === "FIVES" || title.includes("5인")) return 4;
  if (kind === "OVERALL" || title.includes("종합")) return 98;
  return 99;
};

const inferHalfOrder = (input: EventDisplayInput): number => {
  const halfType = normalize(input.halfType);
  const title = normalize(input.title);

  if (halfType === "FIRST" || title.includes("전반")) return 0;
  if (halfType === "SECOND" || title.includes("후반")) return 1;
  return 0;
};

export const getEventDisplayOrder = (input: EventDisplayInput): number =>
  inferKindOrder(input) * 10 + inferHalfOrder(input);

export const compareEventDisplay = (a: EventDisplayInput, b: EventDisplayInput): number => {
  const orderDiff = getEventDisplayOrder(a) - getEventDisplayOrder(b);
  if (orderDiff !== 0) return orderDiff;

  return (a.title ?? "").localeCompare(b.title ?? "", "ko");
};
