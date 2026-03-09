export const SOURCE_GROUPS = [
  {
    id: "naver",
    label: "네이버종토방 지수",
    shortLabel: "네이버종토방"
  },
  {
    id: "toss",
    label: "토스증권 종목커뮤니티 지수",
    shortLabel: "토스증권"
  },
  {
    id: "blind",
    label: "블라인드 주식투자 지수",
    shortLabel: "블라인드"
  },
  {
    id: "dc",
    label: "디시 주갤·국장갤·미장갤 지수",
    shortLabel: "디시 3종"
  }
] as const;

export type SourceGroupId = (typeof SOURCE_GROUPS)[number]["id"];

export const isSourceGroupId = (value: string): value is SourceGroupId => {
  return SOURCE_GROUPS.some((group) => group.id === value);
};

export const matchesSourceGroup = (source: string, groupId: SourceGroupId): boolean => {
  if (groupId === "naver") {
    return source.startsWith("naver_stock_");
  }
  if (groupId === "toss") {
    return source.startsWith("toss_stock_community_");
  }
  if (groupId === "blind") {
    return source === "blind_stock_invest";
  }
  return source === "dc_stock" || source === "dc_krstock" || source === "dc_usstock";
};

export const getSourceGroupId = (source: string): SourceGroupId | null => {
  for (const group of SOURCE_GROUPS) {
    if (matchesSourceGroup(source, group.id)) {
      return group.id;
    }
  }
  return null;
};

