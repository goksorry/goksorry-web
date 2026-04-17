type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type AuthMode = "public" | "tradingbot" | "browser-session" | "admin-session" | "detector";
type Visibility = "all" | "admin";

export type ApiEndpointDoc = {
  method: HttpMethod;
  path: string;
  section: "홈 공개" | "트레이딩봇 조회" | "토큰 관리" | "관리자" | "내부";
  summary: string;
  auth: AuthMode;
  visibility?: Visibility;
  query?: Array<{ name: string; type: string; description: string }>;
  pathParams?: Array<{ name: string; type: string; description: string }>;
  headers?: Array<{ name: string; required?: boolean; description: string }>;
  requestBody?: {
    contentType: string;
    example: Record<string, unknown>;
  };
  responseExample: Record<string, unknown>;
  notes?: string[];
};

const tradingBotHeaders = [
  { name: "Authorization", required: true, description: "Bearer <승인된 트레이딩봇 토큰>" },
  { name: "X-Client-Id", required: true, description: "`trading-bot-`로 시작해야 합니다." },
  { name: "X-Request-Id", required: true, description: "호출 측에서 만든 UUID" }
] satisfies ApiEndpointDoc["headers"];

const browserHeaders = [{ name: "Origin", required: true, description: "같은 출처 브라우저 요청만 허용" }] satisfies ApiEndpointDoc["headers"];

export const apiSections = ["홈 공개", "트레이딩봇 조회", "토큰 관리", "관리자", "내부"] as const;

export const authModeDescriptions: Record<AuthMode, string> = {
  public: "인증 없이 호출할 수 있습니다.",
  tradingbot: "승인된 트레이딩봇 Bearer 토큰과 `X-Client-Id`, `X-Request-Id`가 필요합니다.",
  "browser-session": "로그인된 브라우저 세션과 같은 출처 요청이 필요합니다.",
  "admin-session": "관리자 브라우저 세션이 필요합니다.",
  detector: "내부 detector Bearer 토큰이 필요합니다."
};

export const apiEndpointDocs: ApiEndpointDoc[] = [
  {
    method: "GET",
    path: "/api/community-indicators",
    section: "홈 공개",
    summary: "홈 커뮤니티 카드의 원감성 점수와 표시용 곡소리 지수를 조회합니다.",
    auth: "public",
    query: [
      { name: "market_adjustment", type: "on|off", description: "시장 보정 적용 여부입니다. 기본값은 `on`입니다." }
    ],
    responseExample: {
      generated_at: "2026-04-08T09:30:00.000Z",
      market_adjustment_enabled: true,
      overall_base_score: 5.4,
      overall_market_adjustment: -0.32,
      overall_sentiment_score: 5.1,
      overall_goksorry_index: 5.4,
      overall_sentiment_band: "neutral",
      community_indicators: [
        {
          id: "ppomppu",
          label: "뽐뿌 증권포럼 지수",
          shortLabel: "뽐뿌",
          mentions: 8,
          bullish: 5,
          bearish: 3,
          neutral: 4,
          base_score: 5.6,
          market_adjustment: -0.21,
          score: 5.4,
          goksorry_index: 5.1,
          sentiment_band: "neutral",
          tone: "mixed",
          rows: [
            {
              post_key: "ppomppu:12345",
              source: "ppomppu_stock",
              title: "오늘 국장 반등 보시나요",
              clean_title: "오늘 국장 반등 보시나요",
              url: "https://www.ppomppu.co.kr/zboard/view.php?id=stock&no=12345",
              symbol: null,
              symbol_name: null,
              symbol_market: null,
              label: "bullish",
              sentiment_score: 7,
              confidence: 0.82,
              analyzed_at: "2026-04-08T09:28:00.000Z"
            }
          ]
        }
      ]
    },
    notes: [
      "홈 상단 커뮤니티 카드와 동일한 집계 결과입니다.",
      "`overall_sentiment_score` 와 각 섹션의 `score` 는 내부 원감성 점수이며 높을수록 희망입니다.",
      "`overall_goksorry_index` 와 각 섹션의 `goksorry_index` 는 홈 표시용 반전 점수이며 높을수록 곡소리입니다.",
      "소스 그룹은 토스증권, 뽐뿌, 블라인드, 디시 4종으로 고정됩니다."
    ]
  },
  {
    method: "GET",
    path: "/api/overview",
    section: "홈 공개",
    summary: "홈 상단 시장 지표와 원감성 점수, 표시용 곡소리 지수를 함께 조회합니다.",
    auth: "public",
    query: [
      { name: "market_adjustment", type: "on|off", description: "시장 보정 적용 여부입니다. 기본값은 `on`입니다." }
    ],
    responseExample: {
      generated_at: "2026-04-08T09:30:00.000Z",
      market_indicators: [
        {
          id: "kospi",
          label: "KOSPI",
          value_text: "2,732.11",
          delta_text: "+18.42 (+0.68%)",
          change_value: 18.42,
          change_percent: 0.68,
          tone: "up",
          note: ""
        },
        {
          id: "usdkrw",
          label: "원/달러 환율",
          value_text: "1,351.20",
          delta_text: "+4.10 KRW (+0.30%)",
          change_value: 4.1,
          change_percent: 0.3,
          tone: "up",
          note: "네이버 환율"
        }
      ],
      market_adjustment_enabled: true,
      overall_base_score: 5.4,
      overall_market_adjustment: -0.32,
      overall_sentiment_score: 5.1,
      overall_goksorry_index: 5.4,
      overall_sentiment_band: "neutral",
      community_indicators: [
        {
          id: "ppomppu",
          label: "뽐뿌 증권포럼 지수",
          shortLabel: "뽐뿌",
          mentions: 8,
          bullish: 5,
          bearish: 3,
          neutral: 4,
          base_score: 5.6,
          market_adjustment: -0.21,
          score: 5.4,
          goksorry_index: 5.1,
          sentiment_band: "neutral",
          tone: "mixed",
          rows: [
            {
              post_key: "ppomppu:12345",
              source: "ppomppu_stock",
              title: "오늘 국장 반등 보시나요",
              clean_title: "오늘 국장 반등 보시나요",
              url: "https://www.ppomppu.co.kr/zboard/view.php?id=stock&no=12345",
              symbol: null,
              symbol_name: null,
              symbol_market: null,
              label: "bullish",
              sentiment_score: 7,
              confidence: 0.82,
              analyzed_at: "2026-04-08T09:28:00.000Z"
            }
          ]
        }
      ]
    },
    notes: [
      "`/api/community-indicators` 응답에 KOSPI, KOSDAQ, NASDAQ, 원/달러 환율 요약을 추가한 형태입니다.",
      "`overall_sentiment_score`/`score` 는 원감성 점수, `overall_goksorry_index`/`goksorry_index` 는 홈 표시용 곡소리 지수입니다.",
      "시장 지표와 커뮤니티 지수를 한 번에 받아야 하는 외부 클라이언트용 요약 엔드포인트입니다."
    ]
  },
  {
    method: "GET",
    path: "/api/v1/health",
    section: "트레이딩봇 조회",
    summary: "서비스 상태와 배포 버전을 확인합니다.",
    auth: "public",
    responseExample: {
      status: "ok",
      time: "2026-03-11T10:00:00.000Z",
      version: "1.0.0"
    },
    notes: ["인증 없이 호출할 수 있습니다."]
  },
  {
    method: "GET",
    path: "/api/v1/signals/latest",
    section: "트레이딩봇 조회",
    summary: "한국·미국 시장의 최신 커뮤니티 기반 종목 신호를 조회합니다.",
    auth: "tradingbot",
    query: [
      { name: "market", type: "kr|us|all", description: "시장 필터입니다. 기본값은 `all`입니다." },
      { name: "symbols", type: "csv", description: "선택적 종목 CSV 목록입니다. 최대 100개까지 가능합니다." },
      { name: "max_age_sec", type: "integer", description: "신호 신선도 기준(초)입니다. 기본값은 1800, 최대값은 86400입니다." }
    ],
    headers: tradingBotHeaders,
    responseExample: {
      status: "ok",
      generated_at: "2026-03-11T10:00:00.000Z",
      detector_mode: "normal",
      signals: [
        {
          symbol: "AAPL",
          market: "us",
          asof: "2026-03-11T09:57:00.000Z",
          freshness_sec: 180,
          mentions: 42,
          neg_count: 11,
          pos_count: 20,
          panic_score: 26.19,
          euphoria_score: 47.62,
          signal_quality: 0.81,
          mention_velocity_z: 0,
          confidence_grade: "A",
          source_diversity: 3
        }
      ],
      missing_symbols: [],
      ttl_sec: 60
    },
    notes: [
      "이 API는 커뮤니티에서 파생된 신호만 제공합니다.",
      "공식 시세, 지수, 거시 지표 원데이터는 봇이 별도로 수집해야 합니다."
    ]
  },
  {
    method: "GET",
    path: "/api/v1/signals/{symbol}",
    section: "트레이딩봇 조회",
    summary: "특정 종목 하나의 최신 신호 스냅샷을 조회합니다.",
    auth: "tradingbot",
    pathParams: [{ name: "symbol", type: "string", description: "티커 또는 종목 코드입니다. 최대 20자입니다." }],
    headers: tradingBotHeaders,
    responseExample: {
      symbol: "AAPL",
      market: "us",
      latest: {
        symbol: "AAPL",
        market: "us",
        asof: "2026-03-11T09:57:00.000Z",
        freshness_sec: 180,
        mentions: 42,
        neg_count: 11,
        pos_count: 20,
        panic_score: 26.19,
        euphoria_score: 47.62,
        signal_quality: 0.81,
        mention_velocity_z: 0,
        confidence_grade: "A",
        source_diversity: 3
      },
      window: {
        long_min: 120,
        short_min: 20
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/market/latest",
    section: "트레이딩봇 조회",
    summary: "시장 단위의 최신 커뮤니티 레짐과 공포 지수를 조회합니다.",
    auth: "tradingbot",
    query: [{ name: "market", type: "kr|us|all", description: "시장 필터입니다. 기본값은 `all`입니다." }],
    headers: tradingBotHeaders,
    responseExample: {
      status: "ok",
      generated_at: "2026-03-11T10:00:00.000Z",
      markets: [
        {
          market: "kr",
          asof: "2026-03-11T09:58:00.000Z",
          regime: "risk_off",
          fear_index: 67.5,
          payload: {
            avg_euphoria: 31.2,
            avg_sentiment_score: 3.84,
            symbol_count: 18,
            pos_count: 42,
            neg_count: 71,
            neutral_count: 19,
            actionable_count: 113,
            dominant_share: 0.6283,
            regime_basis: "post_dominance_v1"
          }
        }
      ],
      ttl_sec: 60
    },
    notes: [
      "레짐과 공포 지수는 공식 거래소 지표가 아니라 커뮤니티 활동에서 파생된 값입니다.",
      "regime은 최근 수집 글의 bullish/bearish 우세로 계산하고, fear_index는 평균 sentiment score에서 파생합니다."
    ]
  },
  {
    method: "GET",
    path: "/api/v1/status",
    section: "트레이딩봇 조회",
    summary: "봇 측 안전 점검을 위한 detector 파이프라인 상태를 조회합니다.",
    auth: "tradingbot",
    headers: tradingBotHeaders,
    responseExample: {
      status: "ok",
      detector_mode: "normal",
      collector: {
        last_run_at: "2026-03-11T09:59:00.000Z",
        errors: 0
      },
      llm: {
        provider: "gemini",
        last_run_at: "2026-03-11T09:59:00.000Z",
        degraded: false
      },
      sources: {
        us_cooldown_until: null,
        hold_list: []
      }
    }
  },
  {
    method: "GET",
    path: "/api/v1/tokens",
    section: "토큰 관리",
    summary: "내 토큰 요청 내역과 발급 완료된 토큰을 조회합니다.",
    auth: "browser-session",
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      tokens: [
        {
          id: "uuid",
          name: "tradingbot-main",
          token_prefix: "gkst_123456789ab",
          scope: "tradingbot.read",
          approval_status: "approved",
          approval_requested_at: "2026-03-11T10:00:00.000Z",
          approved_at: "2026-03-11T10:05:00.000Z",
          rejected_at: null,
          approval_note: null,
          created_at: "2026-03-11T10:00:00.000Z",
          last_used_at: "2026-03-11T10:06:00.000Z",
          expires_at: "2027-03-11T10:05:00.000Z",
          revoked_at: null,
          token_claimed: true,
          claim_ready: false
        }
      ]
    },
    notes: ["로그인이 필요합니다.", "같은 출처 브라우저 요청만 허용됩니다."]
  },
  {
    method: "POST",
    path: "/api/v1/tokens",
    section: "토큰 관리",
    summary: "새 토큰 발급 요청을 등록합니다. 관리자 승인이 필요합니다.",
    auth: "browser-session",
    headers: [{ name: "Content-Type", required: true, description: "`application/json`" }, ...browserHeaders],
    requestBody: {
      contentType: "application/json",
      example: {
        name: "tradingbot-main"
      }
    },
    responseExample: {
      status: "ok",
      token_request: {
        id: "uuid",
        name: "tradingbot-main",
        approval_status: "pending",
        approval_requested_at: "2026-03-11T10:00:00.000Z",
        claim_ready: false
      },
      note: "token request submitted. admin approval is required before the token can be revealed"
    },
    notes: [
      "토큰을 실제로 확인한 시점부터 만료일은 항상 1년 뒤로 고정됩니다.",
      "회원 1명당 폐기되지 않은 `pending` 또는 `approved` 상태 요청은 최대 3개까지 유지할 수 있습니다."
    ]
  },
  {
    method: "POST",
    path: "/api/v1/tokens/{id}/claim",
    section: "토큰 관리",
    summary: "승인된 토큰의 실제 값을 1회 확인합니다.",
    auth: "browser-session",
    pathParams: [{ name: "id", type: "uuid", description: "토큰 요청 ID" }],
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      token: {
        id: "uuid",
        name: "tradingbot-main",
        token_prefix: "gkst_123456789ab",
        scope: "tradingbot.read",
        approved_at: "2026-03-11T10:05:00.000Z",
        expires_at: "2027-03-11T10:05:00.000Z",
        value: "gkst_full_secret_value"
      },
      note: "token value is shown only once"
    },
    notes: ["승인되었고 아직 실제 값을 확인하지 않은 요청만 claim할 수 있습니다."]
  },
  {
    method: "POST",
    path: "/api/v1/tokens/{id}/revoke",
    section: "토큰 관리",
    summary: "기존 토큰을 폐기하거나 대기 중인 요청을 취소합니다.",
    auth: "browser-session",
    pathParams: [{ name: "id", type: "uuid", description: "토큰 요청 ID" }],
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      revoked: true,
      token_id: "uuid"
    }
  },
  {
    method: "GET",
    path: "/api/admin/tokens",
    section: "관리자",
    summary: "관리자 승인 대상 토큰 요청 목록을 조회합니다.",
    auth: "admin-session",
    visibility: "admin",
    query: [{ name: "status", type: "pending|approved|rejected|all", description: "상태 필터입니다. 기본값은 `pending`입니다." }],
    responseExample: {
      status: "ok",
      filter: "pending",
      tokens: [
        {
          id: "uuid",
          requester_nickname: "곡소리봇",
          requester_email: "goksorrybot@gmail.com",
          name: "tradingbot-main",
          approval_status: "pending",
          token_claimed: false
        }
      ]
    },
    notes: ["관리자 세션이 필요합니다."]
  },
  {
    method: "POST",
    path: "/api/admin/tokens/{id}",
    section: "관리자",
    summary: "대기 중인 토큰 요청을 승인하거나 거절합니다.",
    auth: "admin-session",
    visibility: "admin",
    pathParams: [{ name: "id", type: "uuid", description: "토큰 요청 ID" }],
    headers: [{ name: "Content-Type", required: true, description: "`application/json`" }, ...browserHeaders],
    requestBody: {
      contentType: "application/json",
      example: {
        decision: "approve",
        note: "approved for trading bot integration"
      }
    },
    responseExample: {
      status: "ok",
      token_id: "uuid",
      decision: "approve"
    }
  },
  {
    method: "DELETE",
    path: "/api/admin/tokens/{id}",
    section: "관리자",
    summary: "회원 토큰 또는 대기 중인 토큰 요청을 강제로 삭제합니다.",
    auth: "admin-session",
    visibility: "admin",
    pathParams: [{ name: "id", type: "uuid", description: "토큰 요청 ID" }],
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      token_id: "uuid",
      deleted: true
    },
    notes: ["이 화면에서는 관리자 본인 소유 토큰은 강제 삭제하지 못하게 보호됩니다."]
  },
  {
    method: "GET",
    path: "/api/admin/members",
    section: "관리자",
    summary: "페이징과 이메일·닉네임 검색 조건으로 회원 목록을 조회합니다.",
    auth: "admin-session",
    visibility: "admin",
    query: [
      { name: "page", type: "integer", description: "페이지 번호입니다. 기본값은 1입니다." },
      { name: "page_size", type: "integer", description: "페이지당 행 수입니다. 기본값은 20, 최대값은 100입니다." },
      { name: "q", type: "string", description: "이메일 또는 닉네임 검색어입니다." }
    ],
    responseExample: {
      status: "ok",
      query: "member",
      members: [
        {
          id: "uuid",
          email: "member@example.com",
          nickname: "개미123",
          role: "user",
          created_at: "2026-03-11T09:00:00.000Z",
          is_current_user: false
        }
      ],
      pagination: {
        page: 1,
        page_size: 20,
        total_count: 148,
        total_pages: 8,
        has_prev: false,
        has_next: true
      }
    },
    notes: ["관리자 회원 목록 테이블에는 이 API를 사용하고, 토큰 상세 목록은 회원 상세 API에서 조회합니다."]
  },
  {
    method: "GET",
    path: "/api/admin/members/{id}",
    section: "관리자",
    summary: "토큰 보유 현황을 포함한 회원 상세 1건을 조회합니다.",
    auth: "admin-session",
    visibility: "admin",
    pathParams: [{ name: "id", type: "uuid", description: "회원 프로필 ID" }],
    responseExample: {
      status: "ok",
      member: {
        id: "uuid",
        email: "member@example.com",
        nickname: "개미123",
        role: "user",
        created_at: "2026-03-11T09:00:00.000Z",
        nickname_confirmed_at: "2026-03-11T09:00:00.000Z",
        nickname_changed_at: "2026-03-11T09:15:00.000Z",
        is_current_user: false,
        active_token_count: 1,
        total_token_count: 2,
        tokens: [
          {
            id: "uuid",
            name: "tradingbot-main",
            token_prefix: "gkst_123456789ab",
            scope: "tradingbot.read",
            approval_status: "approved",
            approval_requested_at: "2026-03-11T10:00:00.000Z",
            approved_at: "2026-03-11T10:05:00.000Z",
            rejected_at: null,
            approval_note: null,
            created_at: "2026-03-11T10:00:00.000Z",
            last_used_at: "2026-03-11T10:06:00.000Z",
            expires_at: "2027-03-11T10:05:00.000Z",
            revoked_at: null,
            token_claimed: true,
            claim_ready: false
          }
        ]
      }
    }
  },
  {
    method: "PATCH",
    path: "/api/admin/members/{id}",
    section: "관리자",
    summary: "회원 닉네임을 강제로 변경합니다.",
    auth: "admin-session",
    visibility: "admin",
    pathParams: [{ name: "id", type: "uuid", description: "회원 프로필 ID" }],
    headers: [{ name: "Content-Type", required: true, description: "`application/json`" }, ...browserHeaders],
    requestBody: {
      contentType: "application/json",
      example: {
        nickname: "새닉네임"
      }
    },
    responseExample: {
      status: "ok",
      member: {
        id: "uuid",
        nickname: "새닉네임"
      }
    }
  },
  {
    method: "DELETE",
    path: "/api/admin/members/{id}",
    section: "관리자",
    summary: "회원 계정을 강제로 탈퇴 처리합니다.",
    auth: "admin-session",
    visibility: "admin",
    pathParams: [{ name: "id", type: "uuid", description: "회원 프로필 ID" }],
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      member_id: "uuid",
      withdrawn: true
    },
    notes: ["프로필, 커뮤니티 글/댓글, 투표, 신고, API 토큰이 함께 정리됩니다."]
  },
  {
    method: "POST",
    path: "/api/v1/detector/register",
    section: "내부",
    summary: "내부 detector 스냅샷을 upsert하는 엔드포인트입니다.",
    auth: "detector",
    visibility: "admin",
    headers: [{ name: "Authorization", required: true, description: "Bearer <DETECTOR_WRITE_TOKEN>" }],
    requestBody: {
      contentType: "application/json",
      example: {
        signals: [],
        market_state: [],
        status: {}
      }
    },
    responseExample: {
      status: "ok",
      request_id: "uuid",
      upserted_signals: 12,
      upserted_market_state: 2,
      status_updated: true
    },
    notes: ["내부 worker가 web으로 데이터를 적재할 때 쓰는 API이며, 공개 클라이언트용이 아닙니다."]
  }
];

export const filterApiDocs = (isAdmin: boolean): ApiEndpointDoc[] => {
  return apiEndpointDocs.filter((doc) => {
    if (doc.section === "토큰 관리") {
      return false;
    }
    return isAdmin || doc.visibility !== "admin";
  });
};

export const buildOpenApiSpec = () => {
  return buildOpenApiSpecForRole(false);
};

const buildPlainTextSection = (title: string, lines: string[]) => {
  return [`[${title}]`, ...lines, ""].join("\n");
};

const renderParamBlock = (
  label: string,
  params: Array<{ name: string; type: string; description: string }> | undefined
) => {
  if (!params?.length) {
    return [];
  }

  return [label, ...params.map((param) => `- ${param.name} (${param.type}): ${param.description}`)];
};

const renderHeaderBlock = (
  headers: Array<{ name: string; required?: boolean; description: string }> | undefined
) => {
  if (!headers?.length) {
    return [];
  }

  return [
    "헤더",
    ...headers.map((header) => `- ${header.name}${header.required ? " [필수]" : ""}: ${header.description}`)
  ];
};

export const buildRawTextApiDocs = () => {
  const visibleDocs = filterApiDocs(false);
  const publicAuthModes = [...new Set(visibleDocs.map((doc) => doc.auth))];
  const sections = apiSections
    .filter((section) => visibleDocs.some((doc) => doc.section === section))
    .map((section) => ({
      section,
      items: visibleDocs.filter((doc) => doc.section === section)
    }));

  const blocks: string[] = [
    "곡소리닷컴 API 텍스트 문서",
    "",
    "이 문서는 관리자 전용을 제외한 공개 홈 API와 TradingBot 조회 API를 포함합니다.",
    "트레이딩봇 토큰 요청, 승인 후 확인, 폐기는 API로 안내하지 않으며 브라우저의 `/profile` 화면에서 처리합니다.",
    "브라우저 세션이 필요한 토큰 관리 API와 내부 detector API는 포함하지 않습니다.",
    "",
    buildPlainTextSection(
      "인증 방식",
      publicAuthModes.map((mode) => `- ${mode}: ${authModeDescriptions[mode]}`)
    )
  ];

  for (const { section, items } of sections) {
    const sectionLines: string[] = [];

    for (const endpoint of items) {
      sectionLines.push(`${endpoint.method} ${endpoint.path}`);
      sectionLines.push(`요약: ${endpoint.summary}`);
      sectionLines.push(`인증: ${endpoint.auth} - ${authModeDescriptions[endpoint.auth]}`);

      const pathParams = renderParamBlock("경로 파라미터", endpoint.pathParams);
      const queryParams = renderParamBlock("쿼리", endpoint.query);
      const headers = renderHeaderBlock(endpoint.headers);
      if (pathParams.length) {
        sectionLines.push(...pathParams);
      }
      if (queryParams.length) {
        sectionLines.push(...queryParams);
      }
      if (headers.length) {
        sectionLines.push(...headers);
      }

      if (endpoint.requestBody) {
        sectionLines.push(`요청 본문 예시 (${endpoint.requestBody.contentType})`);
        sectionLines.push(JSON.stringify(endpoint.requestBody.example, null, 2));
      }

      sectionLines.push("응답 예시");
      sectionLines.push(JSON.stringify(endpoint.responseExample, null, 2));

      if (endpoint.notes?.length) {
        sectionLines.push("비고");
        sectionLines.push(...endpoint.notes.map((note) => `- ${note}`));
      }

      sectionLines.push("");
    }

    blocks.push(buildPlainTextSection(section, sectionLines));
  }

  return blocks.join("\n").trimEnd() + "\n";
};

export const buildOpenApiSpecForRole = (isAdmin: boolean) => {
  const visibleDocs = filterApiDocs(isAdmin);

  const paths = visibleDocs.reduce<Record<string, Record<string, unknown>>>((acc, doc) => {
    const operation: Record<string, unknown> = {
      tags: [doc.section],
      summary: doc.summary,
      parameters: [
        ...(doc.pathParams ?? []).map((param) => ({
          in: "path",
          name: param.name,
          required: true,
          schema: { type: "string", ...(param.type === "uuid" ? { format: "uuid" } : {}) },
          description: param.description
        })),
        ...(doc.query ?? []).map((param) => ({
          in: "query",
          name: param.name,
          schema: { type: param.type.includes("integer") ? "integer" : "string" },
          description: param.description
        })),
        ...(doc.headers ?? []).map((header) => ({
          in: "header",
          name: header.name,
          required: Boolean(header.required),
          schema: { type: "string" },
          description: header.description
        }))
      ],
      responses: {
        [doc.path === "/api/v1/tokens" && doc.method === "POST" ? "202" : "200"]: {
          description: doc.summary,
          content: {
            "application/json": {
              example: doc.responseExample
            }
          }
        }
      }
    };

    if (doc.requestBody) {
      operation.requestBody = {
        required: true,
        content: {
          [doc.requestBody.contentType]: {
            example: doc.requestBody.example
          }
        }
      };
    }

    const existing = acc[doc.path] ?? {};
    acc[doc.path] = {
      ...existing,
      [doc.method.toLowerCase()]: operation
    };
    return acc;
  }, {});

  return {
    openapi: "3.1.0",
    info: {
      title: "곡소리닷컴 API",
      version: "1.0.0",
      description:
        "곡소리닷컴 홈 공개 지표와 트레이딩봇 연동을 위한 커뮤니티 기반 주식·거시 심리 API입니다. 공식 시세와 지수 원데이터는 봇이 별도로 수집해야 합니다."
    },
    servers: [{ url: "https://goksorry.com" }],
    tags: [...new Set(visibleDocs.map((doc) => doc.section))].map((name) => ({ name })),
    paths
  };
};
