export const SOURCE_GROUPS = [
  {
    id: "toss",
    label: "토스증권 커뮤니티 지수",
    shortLabel: "토스증권"
  },
  {
    id: "ppomppu",
    label: "뽐뿌 증권포럼 지수",
    shortLabel: "뽐뿌"
  },
  {
    id: "blind",
    label: "블라인드 주식투자 지수",
    shortLabel: "블라인드"
  },
  {
    id: "dc",
    label: "디시 주갤·국장갤·미장갤·해주갤 지수",
    shortLabel: "디시 4종"
  }
] as const;

export type SourceGroupId = (typeof SOURCE_GROUPS)[number]["id"];
export const SOURCE_GROUP_IDS: SourceGroupId[] = SOURCE_GROUPS.map((group) => group.id);

export const isSourceGroupId = (value: string): value is SourceGroupId => {
  return SOURCE_GROUPS.some((group) => group.id === value);
};

export const normalizeSourceGroupIds = (values: Iterable<string>): SourceGroupId[] => {
  const wanted = new Set<string>();

  for (const value of values) {
    if (isSourceGroupId(value)) {
      wanted.add(value);
    }
  }

  return SOURCE_GROUP_IDS.filter((groupId) => wanted.has(groupId));
};

export const parseSourceGroupSelection = (raw: string): SourceGroupId[] => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return [...SOURCE_GROUP_IDS];
  }

  if (normalized === "none") {
    return [];
  }

  return normalizeSourceGroupIds(normalized.split(",").map((value) => value.trim()));
};

export const serializeSourceGroupSelection = (groupIds: SourceGroupId[]): string => {
  const normalized = normalizeSourceGroupIds(groupIds);
  if (normalized.length === 0) {
    return "none";
  }
  if (normalized.length === SOURCE_GROUP_IDS.length) {
    return "";
  }
  return normalized.join(",");
};

export const getSourceGroupById = (groupId: SourceGroupId): (typeof SOURCE_GROUPS)[number] => {
  return SOURCE_GROUPS.find((group) => group.id === groupId) ?? SOURCE_GROUPS[0];
};

export const matchesSourceGroup = (source: string, groupId: SourceGroupId): boolean => {
  if (groupId === "toss") {
    return source.startsWith("toss_stock_community_") || source.startsWith("toss_lounge_");
  }
  if (groupId === "ppomppu") {
    return source === "ppomppu_stock";
  }
  if (groupId === "blind") {
    return source === "blind_stock_invest";
  }
  return source === "dc_stock" || source === "dc_krstock" || source === "dc_usstock" || source === "dc_tenbagger";
};

export const getSourceGroupId = (source: string): SourceGroupId | null => {
  for (const group of SOURCE_GROUPS) {
    if (matchesSourceGroup(source, group.id)) {
      return group.id;
    }
  }
  return null;
};

export const getSourceGroupShortLabel = (source: string): string => {
  const groupId = getSourceGroupId(source);
  if (!groupId) {
    return source;
  }
  return getSourceGroupById(groupId).shortLabel;
};
