"use client";
import { Ant, Building, INK, SvgButton } from "./diorama";
import type { SceneProps } from "./scene-types";
export default function Plaza({ frame, mobile, onScene, onEvidence }: SceneProps) {
  const evidence = Object.values(frame.overall.evidence).flat();
  return <g>
    <Building x={395} y={295} name="개미 생태계" sub="요즘 누가 시끄러울까?" color="#90b399" onClick={() => onScene("ecosystem")} />
    <Building x={775} y={285} name="심리 전장" sub="희망군 vs 절망군" color="#d2a789" kind="battle" onClick={() => onScene("battle")} />
    <Building x={300} y={478} name="재난방송국" sub="삐에로 앵커 대기 중" color="#8baab9" kind="broadcast" onClick={() => onScene("broadcast")} />
    <Building x={880} y={477} name="오늘의 개미극장" sub="하루를 30초로" color="#bf8895" kind="theater" onClick={() => onScene("theater")} />
    <SvgButton x={592} y={430} label="광장 개미들의 근거 글" onClick={() => onEvidence({ title: "광장의 목소리", summary: frame.overall })}>
      <ellipse cy="19" rx="77" ry="29" fill="#c3b7a0" />
      <ellipse rx="73" ry="28" fill="#f2e9cc" stroke={INK} strokeWidth="2" />
      <path d="M-48-6l49-25 48 26-49 25Z" fill="#a9c6bd" stroke={INK} strokeWidth="2" />
      <path d="M0-37v-58" stroke={INK} strokeWidth="3" /><path d="M0-95l54 15L0-65" fill="#f1ce70" stroke={INK} strokeWidth="2" />
      <text x="19" y="-77" fontSize="10" fill={INK}>존버</text>
    </SvgButton>
    {Array.from({ length: frame.overall.total ? mobile ? 10 : 23 : 3 }, (_, i) => {
      const row = evidence[i % (evidence.length || 1)];
      return <Ant key={i} x={400 + (i * 83 % 410)} y={380 + (i * 47 % 165)} scale={.65 + (i % 3) * .08}
        delay={-i * .34} mood={row?.label === "bullish" ? "hope" : row?.label === "bearish" ? "fear" : "neutral"}
        color={i % 2 ? "#89716d" : "#7d8a7c"} label={row ? `광장 개미 ${i + 1} 근거 글` : undefined}
        onClick={row ? () => onEvidence({ title: "광장의 목소리", summary: frame.overall, side: row.label }) : undefined} />;
    })}
  </g>;
}
