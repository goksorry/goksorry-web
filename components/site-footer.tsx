import Link from "next/link";
import { CookieConsentButton } from "@/components/cookie-consent-button";
import {
  getFooterCollectionPolicy,
  type FooterCollectionPolicy,
  type FooterCollectionPolicySource
} from "@/lib/collection-policy-status";

const SOURCE_LINKS = [
  {
    label: "뽐뿌 증권포럼",
    href: "https://www.ppomppu.co.kr/zboard/zboard.php?id=stock",
    sourceNames: ["ppomppu_stock"]
  },
  {
    label: "토스증권 커뮤니티",
    href: "https://www.tossinvest.com/",
    sourceNames: ["toss_stock_community", "toss_lounge"]
  },
  {
    label: "한국투자증권(종목정보)",
    href: "https://securities.koreainvestment.com/"
  },
  {
    label: "블라인드 주식·투자",
    href: "https://www.teamblind.com/kr/topics/%EC%A3%BC%EC%8B%9D%C2%B7%ED%88%AC%EC%9E%90",
    sourceNames: ["blind_stock_invest"]
  },
  {
    label: "디시인사이드 주식 갤러리",
    href: "https://gall.dcinside.com/board/lists/?id=neostock",
    sourceNames: ["dc_stock"]
  },
  {
    label: "디시인사이드 국내주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=krstock",
    sourceNames: ["dc_krstock"]
  },
  {
    label: "디시인사이드 미국주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=stockus",
    sourceNames: ["dc_usstock"]
  },
  {
    label: "디시인사이드 해외주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=tenbagger",
    sourceNames: ["dc_tenbagger"]
  }
];

type SourceLink = (typeof SOURCE_LINKS)[number];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short"
});

const sourceByName = (policy: FooterCollectionPolicy | null): Map<string, FooterCollectionPolicySource> => {
  return new Map((policy?.sources ?? []).map((source) => [source.sourceName, source]));
};

const latestCheckedAt = (sources: FooterCollectionPolicySource[]): string | null => {
  const values = sources
    .map((source) => source.checkedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return values[values.length - 1] ?? null;
};

const sourcePolicyState = (
  source: SourceLink,
  policy: FooterCollectionPolicy | null,
  byName: Map<string, FooterCollectionPolicySource>
) => {
  const sourceNames = "sourceNames" in source ? source.sourceNames : undefined;
  if (!sourceNames?.length || !policy) {
    return null;
  }

  const statuses = sourceNames.flatMap((name) => {
    const status = byName.get(name);
    return status ? [status] : [];
  });
  if (!statuses.length) {
    return null;
  }

  const inactiveStatus = statuses.find((status) => !status.allowFetch || status.postponed);
  const detailDisabled = !inactiveStatus && statuses.some((status) => !status.allowDetail);
  return {
    inactive: Boolean(inactiveStatus),
    detailDisabled,
    reason: inactiveStatus?.reason ?? null,
    checkedAt: latestCheckedAt(statuses)
  };
};

const policyTimestampCopy = (policy: FooterCollectionPolicy | null): string => {
  if (!policy?.checkedAt) {
    return "robots.txt와 이용약관 확인은 Pierrot 수집 워커가 24시간 캐시 기준으로 자동 갱신합니다.";
  }

  return `마지막 확인: ${dateFormatter.format(new Date(policy.checkedAt))} · ${policy.refreshHours}시간 캐시 기준 자동 갱신`;
};

export async function SiteFooter() {
  const collectionPolicy = await getFooterCollectionPolicy();
  const policyBySourceName = sourceByName(collectionPolicy);

  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <section className="site-footer-block">
          <h2>곡소리닷컴</h2>
          <p>
            © 2026 곡소리닷컴. 사이트 코드·디자인 및 자체 작성 콘텐츠에 한해 권리를 가집니다.
          </p>
          <p className="muted">
            외부 피드의 제목·링크·원문 권리는 각 원저작자 및 원 서비스에 있습니다. 본 서비스는 AI를 활용해 투자 커뮤니티의
            분위기와 흐름을 분석·정리해 보여주는 참고용 서비스이며, 실제 시장 지수나 공식 통계와는 다른 결과를 표시할 수
            있습니다. 투자자문 또는 투자 권유를 제공하지 않습니다.
          </p>
          <p className="muted">
            문의: <a href="mailto:admin@goksorry.com">admin@goksorry.com</a>
          </p>
        </section>

        <section className="site-footer-block">
          <h2>정책</h2>
          <div className="site-footer-links">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <CookieConsentButton />
          </div>
        </section>

        <section className="site-footer-block">
          <div className="site-footer-heading">
            <h2>출처</h2>
            <details className="site-footer-info">
              <summary className="site-footer-info-trigger" aria-label="출처 기준 안내">
                <span aria-hidden="true">i</span>
              </summary>
              <div className="site-footer-info-copy">
                <p>
                  외부 커뮤니티 수집 여부는 각 사이트의 robots.txt를 읽고 확인한 뒤 반영합니다. 아래 목록도 그 기준에 맞춰
                  관리합니다.
                </p>
                <p className="site-footer-info-timestamp">
                  {policyTimestampCopy(collectionPolicy)}
                </p>
              </div>
            </details>
          </div>
          <div className="site-footer-links">
            {SOURCE_LINKS.map((source) => {
              const policyState = sourcePolicyState(source, collectionPolicy, policyBySourceName);
              const className = [
                "site-footer-source-link",
                policyState?.inactive ? "site-footer-source-link-inactive" : "",
                policyState?.detailDisabled ? "site-footer-source-link-detail-disabled" : ""
              ]
                .filter(Boolean)
                .join(" ");
              const policyDataState = policyState?.inactive
                ? "inactive"
                : policyState?.detailDisabled
                  ? "detail-disabled"
                  : policyState
                    ? "active"
                    : "untracked";
              const policyTitle = policyState?.inactive
                ? `현재 수집 보류: ${policyState.reason ?? "policy"}${
                    policyState.checkedAt ? ` · ${dateFormatter.format(new Date(policyState.checkedAt))}` : ""
                  }`
                : undefined;

              return (
                <a
                  key={source.href}
                  className={className}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  data-policy-state={policyDataState}
                  title={policyTitle}
                >
                  {source.label}
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </footer>
  );
}
