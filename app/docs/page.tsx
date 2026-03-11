import Link from "next/link";
import { getUserFromAuthorization, isAdminEmail } from "@/lib/auth-server";
import { apiSections, authModeDescriptions, filterApiDocs } from "@/lib/api-docs";

const sectionDescriptions: Record<(typeof apiSections)[number], string> = {
  "TradingBot Read": "자동거래봇이 읽는 커뮤니티 지수 API입니다. 공식 시세와 거시 원데이터는 봇이 별도로 가져가고, 여기서는 커뮤니티 기반 신호만 제공합니다.",
  "Token Lifecycle": "사용자가 내 프로필에서 토큰을 요청하고, 승인 후 1회 확인하고, 필요시 폐기하는 흐름입니다.",
  Admin: "관리자가 토큰 요청을 승인하거나 반려하는 운영 API입니다.",
  Internal: "내부 detector 워커가 web에 snapshot을 등록하는 비공개 성격의 API입니다."
};

const prettyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const user = await getUserFromAuthorization();
  const isAdmin = Boolean(user && (user.role === "admin" || isAdminEmail(user.email)));
  const visibleDocs = filterApiDocs(isAdmin);
  const visibleSections = apiSections.filter((section) => visibleDocs.some((item) => item.section === section));
  const endpointGroups = visibleSections.map((section) => ({
    section,
    items: visibleDocs.filter((item) => item.section === section)
  }));

  return (
    <section className="panel docs-shell">
      <div className="docs-hero">
        <div>
          <p className="docs-kicker">API Docs</p>
          <h1>곡소리닷컴 API 문서</h1>
          <p className="muted">
            이 API는 공식 시세 제공 서비스가 아니라, 곡소리닷컴의 커뮤니티 기반 주식/거시 체감 지수를 TradingBot에 전달하는 용도입니다.
          </p>
        </div>
        <div className="actions">
          <Link href="/openapi.json" className="tag">
            openapi.json
          </Link>
          <Link href="/profile" className="tag">
            내 프로필
          </Link>
          {isAdmin ? (
            <Link href="/admin/tokens" className="tag">
              토큰 승인
            </Link>
          ) : null}
        </div>
      </div>

      <div className="docs-top-grid">
        <article className="card">
          <h2>빠른 시작</h2>
          <ol>
            <li>사용자가 `내 프로필`에서 TradingBot 토큰을 요청합니다.</li>
            <li>관리자가 `/admin/tokens`에서 승인합니다.</li>
            <li>사용자가 다시 `내 프로필`에서 토큰 값을 1회 확인합니다.</li>
            <li>봇은 `Authorization`, `X-Client-Id`, `X-Request-Id` 헤더와 함께 `/api/v1/*`를 호출합니다.</li>
          </ol>
        </article>

        <article className="card">
          <h2>인증 방식</h2>
          <div className="list">
            {Object.entries(authModeDescriptions).map(([key, value]) => (
              isAdmin || (key !== "admin-session" && key !== "detector") ? (
                <p key={key}>
                  <span className="tag">{key}</span> {value}
                </p>
              ) : null
            ))}
          </div>
        </article>
      </div>

      <article className="card">
        <h2>TradingBot 호출 예시</h2>
        <pre className="docs-code">
          <code>{`curl -s "https://goksorry.com/api/v1/signals/latest?market=us&symbols=AAPL,NVDA" \\
  -H "Authorization: Bearer gkst_your_token" \\
  -H "X-Client-Id: trading-bot-main" \\
  -H "X-Request-Id: 11111111-1111-1111-1111-111111111111"`}</code>
        </pre>
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

                {endpoint.pathParams?.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Path Param</th>
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
                          <th>Query</th>
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
                          <th>Header</th>
                          <th>필수</th>
                          <th>설명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.headers.map((header) => (
                          <tr key={header.name}>
                            <td>{header.name}</td>
                            <td>{header.required ? "yes" : "no"}</td>
                            <td>{header.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {endpoint.requestBody ? (
                  <div>
                    <h3>Request Body</h3>
                    <pre className="docs-code">
                      <code>{prettyJson(endpoint.requestBody.example)}</code>
                    </pre>
                  </div>
                ) : null}

                <div>
                  <h3>Response Example</h3>
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
