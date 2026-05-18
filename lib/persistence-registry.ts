export type ConsentCategory = "essential" | "analytics";
export type CookieSameSite = "Lax" | "Strict" | "None";

// Register every new cookie/localStorage key here before using it anywhere else in the app.

type PersistenceDefinitionBase = {
  key: string;
  category: ConsentCategory;
  label: string;
  description: string;
};

export type CookiePersistenceDefinition = PersistenceDefinitionBase & {
  kind: "cookie";
  maxAgeSeconds: number;
  path: string;
  sameSite: CookieSameSite;
  httpOnly?: boolean;
};

export type LocalStoragePersistenceDefinition = PersistenceDefinitionBase & {
  kind: "localStorage";
};

export type PersistenceDefinition = CookiePersistenceDefinition | LocalStoragePersistenceDefinition;

export const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
export const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

export const CLIENT_PERSISTENCE_DEFINITIONS = {
  cookieConsent: {
    kind: "cookie",
    key: "goksorry-cookie-consent",
    category: "essential",
    label: "쿠키 동의 상태",
    description: "필수/전체 동의 선택을 기억합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax"
  },
  cleanFilter: {
    kind: "cookie",
    key: "goksorry-clean-filter",
    category: "essential",
    label: "예쁜말 필터 설정",
    description: "피드의 예쁜말 필터 켜짐/꺼짐 상태를 저장합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax"
  },
  marketAdjustment: {
    kind: "cookie",
    key: "goksorry_market_adjustment",
    category: "essential",
    label: "시장 보정 표시 설정",
    description: "홈 시장 보정 토글 상태를 저장합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax"
  },
  guestChatNickname: {
    kind: "cookie",
    key: "goksorry_guest_chat_nickname",
    category: "essential",
    label: "비회원 채팅 닉네임",
    description: "비회원 채팅 참여 시 입력한 닉네임을 저장합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax"
  },
  chatSidebarState: {
    kind: "localStorage",
    key: "goksorry-chat-sidebar-state",
    category: "essential",
    label: "채팅 사이드바 상태",
    description: "데스크탑 채팅 사이드바의 열림/접힘 상태를 저장합니다."
  },
  themeMode: {
    kind: "localStorage",
    key: "goksorry-theme",
    category: "essential",
    label: "테마 설정",
    description: "사이트 전체 테마 선택을 저장합니다."
  },
  themeModeCookie: {
    kind: "cookie",
    key: "goksorry-theme-mode",
    category: "essential",
    label: "테마 설정",
    description: "첫 화면부터 선택한 테마로 렌더링하기 위해 사이트 전체 테마 선택을 저장합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax"
  }
} as const satisfies Record<string, PersistenceDefinition>;

export const SERVER_COOKIE_DEFINITIONS = {
  guestChat: {
    kind: "cookie",
    key: "goksorry_guest_chat",
    category: "essential",
    label: "비회원 채팅 세션",
    description: "채팅 세션을 위한 비회원 식별 쿠키입니다.",
    maxAgeSeconds: ONE_WEEK_IN_SECONDS,
    path: "/",
    sameSite: "Lax",
    httpOnly: true
  },
  goksorryRoomGuest: {
    kind: "cookie",
    key: "goksorry_room_guest",
    category: "essential",
    label: "곡소리방 비회원 작성자 세션",
    description: "곡소리방 비회원 작성자가 본인 의견과 덧글을 삭제할 수 있도록 식별합니다.",
    maxAgeSeconds: ONE_YEAR_IN_SECONDS,
    path: "/",
    sameSite: "Lax",
    httpOnly: true
  }
} as const satisfies Record<string, CookiePersistenceDefinition>;

export const GOOGLE_ANALYTICS_COOKIE_PREFIXES = ["_ga", "_gid", "_gat"] as const;

export type ClientPersistenceDefinition =
  (typeof CLIENT_PERSISTENCE_DEFINITIONS)[keyof typeof CLIENT_PERSISTENCE_DEFINITIONS];

export type ServerCookieDefinition =
  (typeof SERVER_COOKIE_DEFINITIONS)[keyof typeof SERVER_COOKIE_DEFINITIONS];
