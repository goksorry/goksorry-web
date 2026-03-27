import Link from "next/link";
import { getCompletedProfileForUser, getUserFromAuthorization } from "@/lib/auth-server";
import { apiSections, authModeDescriptions, filterApiDocs } from "@/lib/api-docs";

const sectionDescriptions: Record<(typeof apiSections)[number], string> = {
  "트레이딩봇 조회": "자동거래봇이 읽는 커뮤니티 지수 API입니다. 공식 시세와 거시 원데이터는 봇이 별도로 가져가고, 여기서는 커뮤니티 기반 신호만 제공합니다.",
  "토큰 관리": "사용자가 내 프로필에서 토큰을 요청하고, 승인 후 1회 확인하고, 필요시 폐기하는 흐름입니다.",
  "관리자": "관리자가 토큰 요청을 승인하고, 회원 이메일·닉네임·토큰을 운영 관리하는 API입니다.",
  "내부": "내부 detector 워커가 web에 snapshot을 등록하는 비공개 성격의 API입니다."
};

const prettyJson = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const user = await getUserFromAuthorization();
  const profile = user ? await getCompletedProfileForUser(user) : null;
  const isAdmin = profile?.role === "admin";
  const visibleDocs = filterApiDocs(isAdmin);
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
            이 API는 공식 시세 제공 서비스가 아니라, 곡소리닷컴의 커뮤니티 기반 주식/거시 체감 지수를 TradingBot에 전달하는 용도입니다.
          </p>
          <p className="muted">
            트레이딩봇 토큰 요청, 승인 후 확인, 폐기는 API로 직접 호출하지 말고 `내 프로필` 화면에서 브라우저로 처리하세요.
          </p>
        </div>
        <div className="actions">
          <Link href="/openapi.json" className="tag">
            openapi.json
          </Link>
          <Link href="/docs.txt" className="tag">
            docs.txt
          </Link>
          <Link href="/profile" className="tag">
            내 프로필
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/members" className="tag">
                회원 관리
              </Link>
              <Link href="/admin/tokens" className="tag">
                토큰 승인
              </Link>
            </>
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
