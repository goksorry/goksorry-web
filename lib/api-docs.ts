type HttpMethod = "GET" | "POST";
type AuthMode = "public" | "tradingbot" | "browser-session" | "admin-session" | "detector";

export type ApiEndpointDoc = {
  method: HttpMethod;
  path: string;
  section: "TradingBot Read" | "Token Lifecycle" | "Admin" | "Internal";
  summary: string;
  auth: AuthMode;
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
  { name: "Authorization", required: true, description: "Bearer <approved trading bot token>" },
  { name: "X-Client-Id", required: true, description: "Must start with trading-bot-" },
  { name: "X-Request-Id", required: true, description: "Caller-generated UUID" }
] satisfies ApiEndpointDoc["headers"];

const browserHeaders = [{ name: "Origin", required: true, description: "Same-origin browser request only" }] satisfies ApiEndpointDoc["headers"];

export const apiSections = ["TradingBot Read", "Token Lifecycle", "Admin", "Internal"] as const;

export const authModeDescriptions: Record<AuthMode, string> = {
  public: "No authentication required",
  tradingbot: "Approved TradingBot bearer token + X-Client-Id + X-Request-Id",
  "browser-session": "Logged-in browser session with same-origin request",
  "admin-session": "Admin browser session",
  detector: "Internal detector bearer token"
};

export const apiEndpointDocs: ApiEndpointDoc[] = [
  {
    method: "GET",
    path: "/api/v1/health",
    section: "TradingBot Read",
    summary: "Service health and deployed version.",
    auth: "public",
    responseExample: {
      status: "ok",
      time: "2026-03-11T10:00:00.000Z",
      version: "1.0.0"
    },
    notes: ["No authentication required."]
  },
  {
    method: "GET",
    path: "/api/v1/signals/latest",
    section: "TradingBot Read",
    summary: "Latest community-derived symbol signals for KR/US markets.",
    auth: "tradingbot",
    query: [
      { name: "market", type: "kr|us|all", description: "Market filter. Default: all" },
      { name: "symbols", type: "csv", description: "Optional symbol CSV. Max 100 symbols" },
      { name: "max_age_sec", type: "integer", description: "Freshness threshold. Default: 1800, max: 86400" }
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
      "This API exposes community-derived signals only.",
      "Official prices, indexes, and macro series are expected to be fetched separately by the bot."
    ]
  },
  {
    method: "GET",
    path: "/api/v1/signals/{symbol}",
    section: "TradingBot Read",
    summary: "Latest signal snapshot for a single symbol.",
    auth: "tradingbot",
    pathParams: [{ name: "symbol", type: "string", description: "Ticker or symbol, up to 20 chars" }],
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
    section: "TradingBot Read",
    summary: "Latest market-level community regime and fear index.",
    auth: "tradingbot",
    query: [{ name: "market", type: "kr|us|all", description: "Market filter. Default: all" }],
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
            symbol_count: 18
          }
        }
      ],
      ttl_sec: 60
    },
    notes: ["Regime and fear index are derived from community activity, not official exchange indices."]
  },
  {
    method: "GET",
    path: "/api/v1/status",
    section: "TradingBot Read",
    summary: "Detector pipeline health for bot-side safety checks.",
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
    section: "Token Lifecycle",
    summary: "List your token requests and claimed tokens.",
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
          expires_at: null,
          revoked_at: null,
          token_claimed: true,
          claim_ready: false
        }
      ]
    },
    notes: ["Login required.", "Same-origin browser request required."]
  },
  {
    method: "POST",
    path: "/api/v1/tokens",
    section: "Token Lifecycle",
    summary: "Submit a new token request. Admin approval is required.",
    auth: "browser-session",
    headers: [{ name: "Content-Type", required: true, description: "application/json" }, ...browserHeaders],
    requestBody: {
      contentType: "application/json",
      example: {
        name: "tradingbot-main",
        expires_at: "2026-12-31T23:59:59.000Z"
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
    }
  },
  {
    method: "POST",
    path: "/api/v1/tokens/{id}/claim",
    section: "Token Lifecycle",
    summary: "Reveal the approved token value once.",
    auth: "browser-session",
    pathParams: [{ name: "id", type: "uuid", description: "Token request id" }],
    headers: browserHeaders,
    responseExample: {
      status: "ok",
      token: {
        id: "uuid",
        name: "tradingbot-main",
        token_prefix: "gkst_123456789ab",
        scope: "tradingbot.read",
        approved_at: "2026-03-11T10:05:00.000Z",
        expires_at: null,
        value: "gkst_full_secret_value"
      },
      note: "token value is shown only once"
    },
    notes: ["Only approved and unclaimed requests can be claimed."]
  },
  {
    method: "POST",
    path: "/api/v1/tokens/{id}/revoke",
    section: "Token Lifecycle",
    summary: "Revoke an existing token or cancel a pending request.",
    auth: "browser-session",
    pathParams: [{ name: "id", type: "uuid", description: "Token request id" }],
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
    section: "Admin",
    summary: "List token requests for admin approval.",
    auth: "admin-session",
    query: [{ name: "status", type: "pending|approved|rejected|all", description: "Filter. Default: pending" }],
    responseExample: {
      status: "ok",
      filter: "pending",
      tokens: [
        {
          id: "uuid",
          requester_nickname: "곡소리봇",
          requester_email: "go***@gm***",
          name: "tradingbot-main",
          approval_status: "pending",
          token_claimed: false
        }
      ]
    },
    notes: ["Admin session required."]
  },
  {
    method: "POST",
    path: "/api/admin/tokens/{id}",
    section: "Admin",
    summary: "Approve or reject a pending token request.",
    auth: "admin-session",
    pathParams: [{ name: "id", type: "uuid", description: "Token request id" }],
    headers: [{ name: "Content-Type", required: true, description: "application/json" }, ...browserHeaders],
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
    method: "POST",
    path: "/api/v1/detector/register",
    section: "Internal",
    summary: "Internal detector snapshot upsert endpoint.",
    auth: "detector",
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
    notes: ["Internal worker-to-web API. Not intended for public clients."]
  }
];

export const buildOpenApiSpec = () => {
  const paths = apiEndpointDocs.reduce<Record<string, Record<string, unknown>>>((acc, doc) => {
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
      title: "goksorry API",
      version: "1.0.0",
      description:
        "Community-derived stock and macro sentiment API for TradingBot integrations. Official market prices and indices are fetched separately by the bot."
    },
    servers: [{ url: "https://goksorry.com" }],
    tags: apiSections.map((name) => ({ name })),
    paths
  };
};
