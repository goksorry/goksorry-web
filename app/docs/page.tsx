import type { Metadata } from "next";
import Link from "next/link";
import { apiSections, authModeDescriptions, filterApiDocs, goksorryIndexCalculationNotes } from "@/lib/api-docs";
import { GOKSORRY_INDEX_BANDS } from "@/lib/sentiment-score";
import { buildPageMetadata } from "@/lib/seo";

const sectionDescriptions: Record<(typeof apiSections)[number], string> = {
  "홈 공개": "현재 곡소리 지수만 반환하는 공개 API입니다."
};

const prettyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "API 문서",
  description: "곡소리닷컴 공개 곡소리 지수 API를 설명하는 문서입니다.",
  path: "/docs"
});

export default function DocsPage() {
  const visibleDocs = filterApiDocs(false);
  const visibleAuthModes = new Set(visibleDocs.map((doc) => doc.auth));
  const visibleSections = apiSections.filter((section) => visibleDocs.some((item) => item.section === section));
  const endpointGroups = visibleSections.map((section) => ({
    section,
    items: visibleDocs.filter((item) => item.section === section)
  }));

  return (
    <section className="panel docs-shell">
      <div className="docs-hero">
        <div>
          <p className="docs-kicker">API 문서</p>
          <h1>곡소리닷컴 API 문서</h1>
          <p className="muted">
            유저에게 제공되는 API는 현재 곡소리 지수를 JSON으로 반환하는 단일 endpoint입니다.
          </p>
        </div>
        <div className="actions">
          <Link href="/openapi.json" className="tag">
            openapi.json
          </Link>
          <Link href="/docs.txt" className="tag">
            docs.txt
          </Link>
        </div>
      </div>

      <div className="docs-top-grid">
        <article className="card">
          <h2>빠른 시작</h2>
          <ol>
            <li>`GET /api/overview`를 호출합니다.</li>
            <li>`goksorry_index` 값을 읽습니다.</li>
            <li>`ttl_sec` 동안 같은 값을 캐시로 취급합니다.</li>
          </ol>
        </article>

        <article className="card">
          <h2>인증 방식</h2>
          <div className="list">
            {Object.entries(authModeDescriptions).map(([key, value]) => (
              visibleAuthModes.has(key as keyof typeof authModeDescriptions) ? (
                <p key={key}>
                  <span className="tag">{key}</span> {value}
                </p>
              ) : null
            ))}
          </div>
        </article>
      </div>

      <article className="card">
        <h2>호출 예시</h2>
        <pre className="docs-code">
          <code>{`curl -s "https://goksorry.com/api/overview"`}</code>
        </pre>
      </article>

      <article className="card docs-calculation">
        <h2>지수 계산 방식</h2>
        <p>
          곡소리 지수는 커뮤니티 체감 지표입니다. API가 반환하는 `goksorry_index` 는 0~10 표시용 값이며 높을수록
          공포, 낮을수록 희망입니다.
        </p>
        <ul>
          {goksorryIndexCalculationNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>표시 지수</th>
                <th>구간</th>
              </tr>
            </thead>
            <tbody>
              {GOKSORRY_INDEX_BANDS.map((band) => (
                <tr key={band.range}>
                  <td>{band.range}</td>
                  <td>{band.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {endpointGroups.map(({ section, items }) => (
        <section key={section} className="docs-group">
          <div className="docs-group-head">
            <h2>{section}</h2>
            <p className="muted">{sectionDescriptions[section]}</p>
          </div>

          <div className="list">
            {items.map((endpoint) => (
              <article key={`${endpoint.method}-${endpoint.path}`} className="card docs-endpoint">
                <div className="docs-endpoint-head">
                  <div className="actions">
                    <span className={`docs-method docs-method-${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                    <code className="docs-path">{endpoint.path}</code>
                  </div>
                  <span className="tag">{endpoint.auth}</span>
                </div>

                <p>{endpoint.summary}</p>

                {endpoint.responseFields?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>응답 필드</th>
                          <th>타입</th>
                          <th>설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.responseFields.map((field) => (
                          <tr key={field.name}>
                            <td>{field.name}</td>
                            <td>{field.type}</td>
                            <td>{field.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {endpoint.pathParams?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>경로 파라미터</th>
                          <th>타입</th>
                          <th>설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.pathParams.map((param) => (
                          <tr key={param.name}>
                            <td>{param.name}</td>
                            <td>{param.type}</td>
                            <td>{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {endpoint.query?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>쿼리</th>
                          <th>타입</th>
                          <th>설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.query.map((param) => (
                          <tr key={param.name}>
                            <td>{param.name}</td>
                            <td>{param.type}</td>
                            <td>{param.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {endpoint.headers?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>헤더</th>
                          <th>필수</th>
                          <th>설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.headers.map((header) => (
                          <tr key={header.name}>
                            <td>{header.name}</td>
                            <td>{header.required ? "예" : "아니오"}</td>
                            <td>{header.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {endpoint.requestBody ? (
                  <div>
                    <h3>요청 본문 예시</h3>
                    <pre className="docs-code">
                      <code>{prettyJson(endpoint.requestBody.example)}</code>
                    </pre>
                  </div>
                ) : null}

                <div>
                  <h3>응답 예시</h3>
                  <pre className="docs-code">
                    <code>{prettyJson(endpoint.responseExample)}</code>
                  </pre>
                </div>

                {endpoint.notes?.length ? (
                  <ul>
                    {endpoint.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
