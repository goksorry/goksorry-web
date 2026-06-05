import { GOKSORRY_INDEX_BANDS, GOKSORRY_INDEX_FORMULA_TEXT, GOKSORRY_INDEX_SHORT_DESCRIPTION } from "@/lib/sentiment-score";

type HttpMethod = "GET";
type AuthMode = "public";

export type ApiEndpointDoc = {
  method: HttpMethod;
  path: string;
  section: "홈 공개";
  summary: string;
  auth: AuthMode;
  query?: Array<{ name: string; type: string; description: string }>;
  pathParams?: Array<{ name: string; type: string; description: string }>;
  headers?: Array<{ name: string; required?: boolean; description: string }>;
  requestBody?: {
    contentType: string;
    example: Record<string, unknown>;
  };
  responseFields?: Array<{ name: string; type: string; description: string }>;
  responseExample: Record<string, unknown>;
  notes?: string[];
};

export const apiSections = ["홈 공개"] as const;

export const authModeDescriptions: Record<AuthMode, string> = {
  public: "인증 없이 호출할 수 있습니다."
};

export const goksorryIndexCalculationNotes = [
  GOKSORRY_INDEX_SHORT_DESCRIPTION,
  "내부 sentiment score는 0~10이며 높을수록 희망입니다.",
  "중립 5에서 벗어난 정도를 1.35배 증폭한 뒤 source/종목 시장에 맞는 시장보정을 더합니다.",
  `표시 지수 변환식: ${GOKSORRY_INDEX_FORMULA_TEXT}`,
  `표시 구간: ${GOKSORRY_INDEX_BANDS.map((band) => `${band.range} ${band.label}`).join(" · ")}`,
  "높을수록 공포, 낮을수록 희망입니다."
];

export const apiEndpointDocs: ApiEndpointDoc[] = [
  {
    method: "GET",
    path: "/api/overview",
    section: "홈 공개",
    summary: "현재 곡소리 지수만 조회합니다.",
    auth: "public",
    responseExample: {
      goksorry_index: 4.8,
      generated_at: "2026-04-08T09:30:00.000Z",
      ttl_sec: 60
    },
    responseFields: [
      { name: "goksorry_index", type: "number", description: "0~10 표시용 곡소리 지수입니다. 높을수록 곡소리입니다." },
      { name: "generated_at", type: "string", description: "지수 계산 시각 ISO 문자열입니다." },
      { name: "ttl_sec", type: "number", description: "캐시 권장 시간(초)입니다." }
    ],
    notes: [
      "`goksorry_index` 는 0~10 표시용 점수이며 높을수록 곡소리입니다.",
      ...goksorryIndexCalculationNotes,
      "`generated_at` 은 지수 계산 시각입니다.",
      "`ttl_sec` 동안 캐시된 값으로 취급할 수 있습니다."
    ]
  }
];

export const filterApiDocs = (_isAdmin: boolean): ApiEndpointDoc[] => apiEndpointDocs;

export const buildOpenApiSpec = () => buildOpenApiSpecForRole(false);

const buildPlainTextSection = (title: string, lines: string[]) => [`[${title}]`, ...lines, ""].join("\n");

export const buildRawTextApiDocs = () => {
  const visibleDocs = filterApiDocs(false);
  const blocks: string[] = [
    "곡소리닷컴 API 텍스트 문서",
    "",
    "유저에게 제공되는 API는 현재 곡소리 지수를 반환하는 단일 endpoint입니다.",
    "",
    buildPlainTextSection("지수 계산 방식", goksorryIndexCalculationNotes.map((note) => `- ${note}`)),
    buildPlainTextSection("인증 방식", ["- public: 인증 없이 호출할 수 있습니다."])
  ];

  for (const section of apiSections) {
    const sectionLines: string[] = [];
    for (const endpoint of visibleDocs.filter((doc) => doc.section === section)) {
      sectionLines.push(`${endpoint.method} ${endpoint.path}`);
      sectionLines.push(`요약: ${endpoint.summary}`);
      sectionLines.push(`인증: ${endpoint.auth} - ${authModeDescriptions[endpoint.auth]}`);
      sectionLines.push("응답 예시");
      sectionLines.push(JSON.stringify(endpoint.responseExample, null, 2));

      if (endpoint.responseFields?.length) {
        sectionLines.push("응답 필드");
        sectionLines.push(...endpoint.responseFields.map((field) => `- ${field.name} (${field.type}): ${field.description}`));
      }

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

export const buildOpenApiSpecForRole = (_isAdmin: boolean) => {
  const visibleDocs = filterApiDocs(false);
  const paths = visibleDocs.reduce<Record<string, Record<string, unknown>>>((acc, doc) => {
    acc[doc.path] = {
      [doc.method.toLowerCase()]: {
        tags: [doc.section],
        summary: doc.summary,
        responses: {
          "200": {
            description: doc.summary,
            content: {
              "application/json": {
                example: doc.responseExample
              }
            }
          }
        }
      }
    };
    return acc;
  }, {});

  return {
    openapi: "3.1.0",
    info: {
      title: "곡소리닷컴 API",
      version: "1.0.0",
      description: `곡소리닷컴 현재 곡소리 지수를 반환하는 단일 공개 API입니다. ${goksorryIndexCalculationNotes.join(" ")}`
    },
    servers: [{ url: "https://goksorry.com" }],
    tags: apiSections.map((name) => ({ name })),
    paths
  };
};
