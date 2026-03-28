import Link from "next/link";

const SOURCE_LINKS = [
  {
    label: "네이버페이증권 주주오픈톡",
    href: "https://m.stock.naver.com/"
  },
  {
    label: "토스증권 커뮤니티",
    href: "https://www.tossinvest.com/"
  },
  {
    label: "블라인드 주식·투자",
    href: "https://www.teamblind.com/kr/topics/%EC%A3%BC%EC%8B%9D%C2%B7%ED%88%AC%EC%9E%90"
  },
  {
    label: "디시인사이드 주식 갤러리",
    href: "https://gall.dcinside.com/board/lists/?id=neostock"
  },
  {
    label: "디시인사이드 국내주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=krstock"
  },
  {
    label: "디시인사이드 미국주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=stockus"
  },
  {
    label: "디시인사이드 해외주식 갤러리",
    href: "https://gall.dcinside.com/mgallery/board/lists?id=tenbagger"
  }
];

export function SiteFooter() {
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
          </div>
        </section>

        <section className="site-footer-block">
          <h2>출처</h2>
          <div className="site-footer-links">
            {SOURCE_LINKS.map((source) => (
              <a key={source.href} href={source.href} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </footer>
  );
}
