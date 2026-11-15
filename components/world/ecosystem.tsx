"use client";
import { MOOD_COPY, percent } from "@/lib/world";
import { Ant, INK, moodColor, SvgButton } from "./diorama";
import type { SceneProps } from "./scene-types";
export default function Ecosystem({ frame, mobile, stock, onStock, onEvidence }: SceneProps) {
  return <g>
    <text x="600" y="207" textAnchor="middle" fill={INK} fontSize="19" fontWeight="800">6시간 언급량 TOP 12 · 종목 개미굴</text>
    {frame.stocks.map((item, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 355 + col * 161 + (row % 2 ? 28 : 0), y = 310 + row * 116;
      return <g key={item.symbol}>
        <SvgButton x={x} y={y} label={`${item.name} 개미굴 · ${item.total}건 · ${MOOD_COPY[item.mood]}`} onClick={() => { onStock(item.symbol); onEvidence({ title: item.name, summary: item }); }}>
          <ellipse cy="15" rx="61" ry="25" fill="#8b8c69" opacity=".17" />
          <path d="M-48 6q2-65 48-58q49 1 49 58Z" fill={moodColor(item.mood)} stroke={INK} strokeWidth={stock === item.symbol ? 4 : 2} />
          <ellipse cy="6" rx="27" ry="15" fill="#444643" /><ellipse cy="9" rx="18" ry="9" fill="#272f2e" />
          {item.mood === "hope" && <g><path d="M15-43v-44" stroke={INK} strokeWidth="2" /><path d="M15-87l31 10-31 9" fill="#f2ce72" /><path d="M-43-31l-4-11m16 5l3-10m52 30l9-8" stroke="#de977f" strokeWidth="3" /></g>}
          {item.mood === "fear" && <g fill="#dbb182" stroke={INK} strokeWidth="1.5"><rect x="30" y="4" width="20" height="14" rx="2" /><path d="M35 4v-4h9v4" fill="none" /></g>}
          <rect x="-65" y="27" width="130" height="41" rx="10" fill="#fff8e8" stroke="#b2aa8a" />
          <text y="44" textAnchor="middle" fontSize="13" fill={INK} fontWeight="800">{item.name.length > 13 ? item.name.slice(0, 12) + "…" : item.name}</text>
          <text y="59" textAnchor="middle" fontSize="10" fill="#64665b">{item.total}건 · {item.total < 3 ? "관찰 중" : `희망 ${percent(item.hope_ratio)}`}</text>
        </SvgButton>
        {Array.from({ length: mobile ? 1 : 3 }, (_, a) => <Ant key={a} x={x - 38 + a * 34} y={y + 19} scale={.52} mood={item.mood} delay={-i - a * .7}
          color={moodColor(item.mood)} label={`${item.name} 개미 ${a + 1} 근거 글`} onClick={() => { onStock(item.symbol); onEvidence({ title: item.name, summary: item }); }} />)}
      </g>;
    })}
    {!frame.stocks.length && <text x="600" y="415" textAnchor="middle" fill={INK} fontSize="20">아직 조용한 개미굴 · 종목 언급을 기다리는 중</text>}
  </g>;
}
