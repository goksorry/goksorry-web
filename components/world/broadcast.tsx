"use client";
import { MOOD_COPY, percent } from "@/lib/world";
import { Ant, INK, moodColor, SvgButton } from "./diorama";
import type { SceneProps } from "./scene-types";
export default function Broadcast({ frame, onEvidence }: SceneProps) {
  const enough = frame.communities.filter((c) => c.total >= 3 && !c.collection_disabled);
  const sorted = [...enough].sort((a, b) => a.index - b.index);
  const warm = sorted[0], cold = sorted[sorted.length - 1];
  const headline = warm && cold && warm.id !== cold.id
    ? `${warm.name} ${warm.index} · ${cold.name} ${cold.index}, 커뮤니티 온도 차 ${Math.round(cold.index - warm.index)}p`
    : "현장 표본을 확인 중입니다. 오늘도 마음의 안전벨트를 매세요.";
  return <g>
    <path d="M310 460V245l290-110 290 110v215L600 590Z" fill="#728c92" stroke={INK} strokeWidth="3" />
    <path d="M310 460l290 130 290-130v35L600 625 310 495Z" fill="#536f79" stroke={INK} strokeWidth="3" />
    <rect x="375" y="222" width="450" height="107" rx="12" fill="#273e43" stroke={INK} strokeWidth="4" />
    <text x="600" y="249" textAnchor="middle" fill="#eccd80" fontSize="16" letterSpacing="4">GNN · 곡소리 재난방송</text>
    <text x="600" y="276" textAnchor="middle" fill="#f9f1dc" fontSize="12">{headline}</text>
    <text x="600" y="304" textAnchor="middle" fill="#a7c4bc" fontSize="12">희망 {percent(frame.overall.hope_ratio)} · 공포 {percent(frame.overall.fear_ratio)} · 중립 {frame.overall.neutral}건</text>
    {frame.communities.map((community, i) => <SvgButton key={community.id} x={355 + i * 162} y={365} label={`${community.name} 현장 근거 글`} onClick={() => onEvidence({ title: `${community.name} 현장`, summary: community })}>
      <rect x="-3" y="-7" width="153" height="110" rx="8" fill={moodColor(community.mood)} stroke={INK} strokeWidth="2" />
      <rect x="4" y="0" width="139" height="95" rx="5" fill="#fff5df" opacity=".75" />
      <circle cx="128" cy="15" r="4" fill={community.collection_problem ? "#b67b63" : "#709b7f"} className="world-on-air" />
      <Ant x={34} y={50} scale={.62} mood={community.mood} color={moodColor(community.mood)} />
      <text x="82" y="26" textAnchor="middle" fill={INK} fontSize="12" fontWeight="800">{community.name}</text>
      <text x="83" y="47" textAnchor="middle" fill={INK} fontSize="11">{community.total}건 · 심리 {community.index}</text>
      <text x="74" y="71" textAnchor="middle" fill={INK} fontSize="10">{community.collection_disabled ? "수집 보류" : community.total < 3 ? "관찰 중" : MOOD_COPY[community.mood].split(" · ")[1]}</text>
      <text x="74" y="88" textAnchor="middle" fill="#627263" fontSize="10">관심: {(community.top_stock ?? "대기 중").slice(0, 13)}</text>
    </SvgButton>)}
    <g transform="translate(600 470)">
      <path d="M-35 8l-28-65 40 24L0-80l29 50 35-30-28 69" fill="#e0ba72" stroke={INK} strokeWidth="2" />
      <ellipse cy="-15" rx="37" ry="33" fill="#fff3db" stroke={INK} strokeWidth="2" />
      <path d="M-23-28l12 7-14 9m48-16l-12 7 14 9" fill="#8dabc0" /><circle cy="-13" r="8" fill="#d78a88" />
      <path d={frame.overall.mood === "fear" ? "M-16 5q16-18 32 0" : "M-16-1q16 20 32 0"} fill="none" stroke={INK} strokeWidth="3" />
      <path d="M-63 24L0 5l63 19v35L0 82l-63-23Z" fill="#bf9297" stroke={INK} strokeWidth="2" /><text y="48" textAnchor="middle" fontSize="12" fill={INK}>삐에로 앵커</text>
    </g>
  </g>;
}
