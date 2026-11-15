"use client";
import { percent } from "@/lib/world";
import { Ant, INK, SvgButton } from "./diorama";
import type { SceneProps } from "./scene-types";
export default function Battle({ frame, mobile, stock, onEvidence, reinforcements = 0 }: SceneProps) {
  const item = frame.stocks.find((s) => s.symbol === stock) ?? frame.stocks[0];
  const summary = item ?? frame.overall;
  const front = 390 + (summary.hope_ratio ?? .5) * 420;
  const count = mobile ? 23 : 47; // Include the visitor avatar: 24 / 48 total.
  const hopeCount = summary.total < 3 ? 0 : Math.round(count * summary.bullish / (summary.total || 1));
  const fearCount = summary.total < 3 ? 0 : Math.min(count - hopeCount, Math.round(count * summary.bearish / (summary.total || 1)));
  return <g>
    <text x="600" y="220" fill={INK} textAnchor="middle" fontSize="23" fontWeight="800">{item?.name ?? "전체 커뮤니티"} · 심리 전장</text>
    <text x="600" y="245" fill="#697367" textAnchor="middle" fontSize="13">커뮤니티 심리 비율 · 가격·수익률 예측 아님</text>
    <path d="M250 410L600 218l350 192-350 192Z" fill="#d9ddbd" stroke="#899779" strokeWidth="2" />
    <path d={`M${front - 32} 315l-32 55 24 55-20 55 25 50`} stroke="#f9f4df" strokeWidth="7" strokeDasharray="10 8" fill="none" />
    <SvgButton x={338} y={333} label="희망군 근거 글" onClick={() => onEvidence({ title: `${item?.name ?? "전체"} 희망군`, summary, side: "bullish" })}>
      <path d="M0 0v-100" stroke={INK} strokeWidth="4" /><path d={summary.total >= 3 && (summary.hope_ratio ?? 0) >= .5 ? "M0-100l95 24L0-46Z" : "M0-70l70 16-16 9 16 10-70 12Z"} fill={summary.total < 3 ? "#b8bdb0" : "#84b69a"} stroke={INK} strokeWidth="2" />
      <text x="25" y="-69" fill="#183d30" fontSize="14" fontWeight="800">희망군</text><text x="20" y="25" fill={INK} fontSize="16">{summary.bullish}건 · {percent(summary.hope_ratio)}</text>
    </SvgButton>
    <SvgButton x={800} y={333} label="절망군 근거 글" onClick={() => onEvidence({ title: `${item?.name ?? "전체"} 절망군`, summary, side: "bearish" })}>
      <path d="M60 0v-100" stroke={INK} strokeWidth="4" /><path d={summary.total >= 3 && (summary.fear_ratio ?? 0) >= .5 ? "M60-100l-95 24 95 30Z" : "M60-70l-70 16 16 9-16 10 70 12Z"} fill={summary.total < 3 ? "#b8bdb0" : "#d78e8e"} stroke={INK} strokeWidth="2" />
      <text x="-10" y="-69" fill="#542c34" fontSize="14" fontWeight="800">절망군</text><text x="-15" y="25" fill={INK} fontSize="16">{summary.bearish}건 · {percent(summary.fear_ratio)}</text>
    </SvgButton>
    {Array.from({ length: hopeCount }, (_, i) => <Ant key={`h${i}`} x={350 + i * 29 % Math.max(80, front - 390)} y={390 + i * 23 % 112} scale={.64} color="#89ad91" mood="hope" delay={-i * .21}
      arriving={i < Math.min(3, reinforcements)} label={`희망군 개미 ${i + 1} 근거 글`} onClick={() => onEvidence({ title: "희망군", summary, side: "bullish" })} />)}
    {Array.from({ length: fearCount }, (_, i) => <Ant key={`f${i}`} x={Math.max(front + 30, 650) + i * 31 % 170} y={390 + i * 23 % 112} scale={.64} color="#c08a8d" mood="fear" delay={-i * .27}
      arriving={i < Math.min(3, reinforcements)} label={`절망군 개미 ${i + 1} 근거 글`} onClick={() => onEvidence({ title: "절망군", summary, side: "bearish" })} />)}
    <SvgButton x={600} y={553} label="중립 글 확인" onClick={() => onEvidence({ title: "중립 관찰석", summary, side: "neutral" })}>
      <rect x="-115" y="-19" width="230" height="38" rx="12" fill="#fff7e5" stroke={INK} strokeWidth="2" /><text textAnchor="middle" y="5" fontSize="14" fill={INK}>중립 관찰석 · {summary.neutral}건</text>
    </SvgButton>
    {summary.total < 3 && <text x="600" y="440" fill={INK} textAnchor="middle" fontSize="20">관찰 중 · 표본 3건부터 전선 배치</text>}
  </g>;
}
