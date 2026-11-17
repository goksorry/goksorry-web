import type { SourceGroupId } from "@/lib/feed-source-groups";
const BOARDS: { id: SourceGroupId; name: string; url: string }[] = [
  { id: "toss", name: "토스증권", url: "https://www.tossinvest.com/community" },
  { id: "ppomppu", name: "뽐뿌 증권포럼", url: "https://www.ppomppu.co.kr/zboard/zboard.php?id=stock" },
  { id: "blind", name: "블라인드 주식·투자", url: "https://www.teamblind.com/kr/topics/주식·투자" },
  { id: "dc", name: "디시 주식 갤러리", url: "https://gall.dcinside.com/board/lists/?id=neostock" },
  { id: "dc", name: "디시 국장 갤러리", url: "https://gall.dcinside.com/mgallery/board/lists/?id=krstock" },
  { id: "dc", name: "디시 미국주식 갤러리", url: "https://gall.dcinside.com/mgallery/board/lists/?id=stockus" },
  { id: "dc", name: "디시 해외주식 갤러리", url: "https://gall.dcinside.com/mgallery/board/lists/?id=tenbagger" }
];
export function CommunitySourceLinks({ groups }: { groups?: SourceGroupId[] }) {
  return <section aria-label="출처 게시판"><p className="muted">공개 제목과 원문 링크만 제공합니다. 본문은 원문 사이트에서 확인할 수 있습니다.</p><div className="feed-scope-controls">{BOARDS.filter(b => !groups || groups.includes(b.id)).map(b => <a className="btn btn-secondary" key={b.name} href={b.url} target="_blank" rel="noreferrer">{b.name} ↗</a>)}</div></section>;
}
