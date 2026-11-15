"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { WorldMood } from "@/lib/world";

export const COLORS = ["#ffcf67", "#a4c9b5", "#efa5ac", "#a5b9ec", "#ccace1"];
export const INK = "#343b3b";
export const moodColor = (mood: WorldMood) => mood === "hope" ? "#6bab91" : mood === "fear" ? "#d78282" : mood === "mixed" ? "#d9b66e" : "#9eabb4";

export function Ant({ x = 0, y = 0, color = "#74686b", mood = "neutral", scale = 1, label, onClick, delay = 0, arriving = false }: {
  x?: number; y?: number; color?: string; mood?: WorldMood; scale?: number; label?: string; onClick?: () => void; delay?: number; arriving?: boolean;
}) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`} data-world-ant="true"
    role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={label} aria-hidden={onClick ? undefined : true}
    className={`${onClick ? "world-svg-button" : ""}${arriving ? " world-ant-arriving" : ""}`}
    onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
    onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onClick(); } }}>
    {label && <title>{label}</title>}
    <ellipse cy="17" rx="22" ry="7" fill="#414039" opacity=".13" />
    <g className="world-ant-body" style={{ animationDelay: `${delay}s` }}>
      <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round">
        <path d="M-7 5l-13 8m17-6l-6 12m12-13l9 12M-10-10l-7-12m17 9l6-13" />
        <circle cx="-18" cy="-23" r="1.5" fill={INK} /><circle cx="7" cy="-27" r="1.5" fill={INK} />
      </g>
      <ellipse cx="12" cy="4" rx="12" ry="9" fill={color} stroke={INK} strokeWidth="2.3" />
      <ellipse cx="-1" cy="2" rx="8" ry="7" fill={color} stroke={INK} strokeWidth="2.3" />
      <ellipse cx="-8" cy="-10" rx="13" ry="12" fill={color} stroke={INK} strokeWidth="2.3" />
      <ellipse cx="-14" cy="-12" rx="3" ry="4" fill="#fff9ee" /><ellipse cx="-5" cy="-13" rx="3" ry="4" fill="#fff9ee" />
      <circle cx="-14" cy="-11" r="1.5" fill={INK} /><circle cx="-5" cy="-12" r="1.5" fill={INK} />
      <path d={mood === "fear" ? "M-14-2q5-6 9-1" : "M-14-5q4 5 8 0"} fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      {mood === "hope" && <g stroke={INK} strokeWidth="2"><path d="M22 7v-39" /><path d="M22-32l22 7-22 8" fill="#9cd2b3" /><path d="M-22-26l4-12 9 10" fill="#f5d27f" /></g>}
      {mood === "fear" && <g stroke={INK} strokeWidth="2"><rect x="21" y="-1" width="17" height="16" rx="3" fill="#d6aa77" /><path d="M26-1v-5h6v5M29 0v14" fill="none" /><path d="M-23-12q-5 7 0 8q5-1 0-8" fill="#abd9dd" /></g>}
      {mood === "mixed" && <g><path d="M24 8v-28" stroke={INK} strokeWidth="2" /><rect x="15" y="-34" width="21" height="17" rx="3" fill="#f4d585" stroke={INK} strokeWidth="2" /><text x="25" y="-21" textAnchor="middle" fontSize="13" fill={INK}>?!</text></g>}
    </g>
  </g>;
}

export function SvgButton({ x, y, label, onClick, children }: { x: number; y: number; label: string; onClick: () => void; children: ReactNode }) {
  const group = useRef<SVGGElement>(null);
  const hit = useRef<SVGRectElement>(null);
  useLayoutEffect(() => {
    if (!group.current || !hit.current) return;
    hit.current.setAttribute("width", "0"); hit.current.setAttribute("height", "0");
    const bounds = group.current.getBBox();
    for (const [key, value] of Object.entries({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })) hit.current.setAttribute(key, String(value));
  }, [children]);
  return <g ref={group} transform={`translate(${x} ${y})`} className="world-svg-button" role="button" tabIndex={0} aria-label={label}
    onClick={(e) => { e.stopPropagation(); onClick(); }} onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onClick(); }
    }}><title>{label}</title><rect ref={hit} fill="transparent" pointerEvents="all" />{children}</g>;
}

export function Building({ x, y, name, sub, color, onClick, kind = "house" }: {
  x: number; y: number; name: string; sub: string; color: string; onClick: () => void; kind?: "house" | "broadcast" | "theater" | "battle";
}) {
  return <SvgButton x={x} y={y} label={`${name} 입장`} onClick={onClick}>
    <ellipse cy="40" rx="100" ry="30" fill="#4b443d" opacity=".13" />
    <path d="M-73-65L0-103l85 45L12-18Z" fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M-73-65L12-18v70l-85-42Z" fill="#f0dfbd" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M12-18l73-40v71L12 52Z" fill="#d4bfa0" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
    <path d="M-47 21V-8q14-22 28 14v30" fill="#514c49" stroke={INK} strokeWidth="2" />
    <path d="M37-10l27-14v27L37 17Z" fill="#9fc7c2" stroke={INK} strokeWidth="2" />
    {kind === "broadcast" && <g stroke={INK} strokeWidth="3" fill="none"><path d="M0-103v-51m-14 10l14 12 16-12" /><circle cy="-156" r="5" fill="#dc8383" /><path d="M-26-161q-14 14 0 28m52-28q14 14 0 28" /></g>}
    {kind === "theater" && <g><path d="M-64-60l66 35v31l-66-35Z" fill="#af6d7a" /><path d="M-53-49v28m13-21v28m13-22v29M-14-29v29" stroke="#e7a2ad" strokeWidth="3" /></g>}
    {kind === "battle" && <g stroke={INK} strokeWidth="3"><path d="M-25-88v-58M28-75v-57" /><path d="M-25-146l29 9-29 12" fill="#8fbea5" /><path d="M28-132l28 9-28 12" fill="#d68c8c" /></g>}
    <g transform="translate(0 78)"><rect x="-96" y="-19" width="192" height="50" rx="13" fill="#fff8e9" stroke={INK} strokeWidth="2" /><text textAnchor="middle" y="2" fill={INK} fontSize="18" fontWeight="800">{name}</text><text textAnchor="middle" y="21" fill="#6b6b62" fontSize="11">{sub}</text></g>
  </SvgButton>;
}

export function Diorama({ children, color, emote, reduced, paused, onStep }: {
  children: ReactNode; color: string; emote: string; reduced: boolean; paused: boolean; onStep: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const avatarRef = useRef<SVGGElement>(null);
  const pos = useRef({ x: 600, y: 606 });
  const target = useRef({ x: 600, y: 606 });
  const kick = useRef<() => void>(() => {});
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const clamp = (x: number, y: number) => {
    const cy = Math.max(300, Math.min(650, y));
    const half = Math.min(440, (cy - 190) * 1.8, (770 - cy) * 1.8);
    return { x: Math.max(600 - half, Math.min(600 + half, x)), y: cy };
  };
  const moveTo = (x: number, y: number) => {
    target.current = clamp(x, y);
    if (reduced) {
      pos.current = target.current;
      avatarRef.current?.setAttribute("transform", `translate(${pos.current.x} ${pos.current.y})`);
    } else kick.current();
  };
  useEffect(() => {
    if (paused || reduced) return;
    let raf = 0;
    let last = 0;
    let lastSound = 0;
    const tick = (time: number) => {
      raf = 0;
      const dt = Math.min((time - (last || time)) / 1000, .05);
      last = time;
      const dx = target.current.x - pos.current.x, dy = target.current.y - pos.current.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1) {
        const ratio = reduced ? 1 : Math.min(1, dt * 180 / distance);
        pos.current = { x: pos.current.x + dx * ratio, y: pos.current.y + dy * ratio };
        avatarRef.current?.setAttribute("transform", `translate(${pos.current.x} ${pos.current.y})`);
        if (time - lastSound > 230) { stepRef.current(); lastSound = time; }
      }
      // No React state per animation frame.
      if (distance > 1) raf = requestAnimationFrame(tick);
    };
    kick.current = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
    if (Math.hypot(target.current.x - pos.current.x, target.current.y - pos.current.y) > 1) kick.current();
    return () => { cancelAnimationFrame(raf); kick.current = () => {}; };
  }, [paused, reduced]);
  return <svg ref={svgRef} className="world-diorama" viewBox="0 0 1200 800" aria-label="개미 월드. 바닥 클릭 또는 방향키로 내 개미 이동" role="group" tabIndex={0}
    onPointerDown={(event) => {
      if ((event.target as Element).closest('[role="button"]')) return;
      const svg = svgRef.current;
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      moveTo(point.x, point.y);
      svg.focus();
    }} onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      const delta: Record<string, [number, number]> = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
      const move = delta[event.key];
      if (!move) return;
      event.preventDefault();
      moveTo(target.current.x + move[0], target.current.y + move[1]);
    }}>
    <defs>
      <pattern id="world-grid" width="60" height="34" patternUnits="userSpaceOnUse" patternTransform="skewY(-29)"><path d="M60 0H0v34" fill="none" stroke="#979d80" strokeWidth=".7" opacity=".23" /></pattern>
      <linearGradient id="world-earth" x2="0" y2="1"><stop stopColor="#e9d5ac" /><stop offset="1" stopColor="#ccb88f" /></linearGradient>
    </defs>
    <g aria-hidden="true" className="world-clouds" fill="#fff9ee" opacity=".6"><path d="M100 190q-23-30 4-44q5-30 34-18q30-15 38 17q32 0 29 28Z" /><path d="M970 160q-23-30 4-44q5-30 34-18q30-15 38 17q32 0 29 28Z" /></g>
    <ellipse cx="600" cy="670" rx="423" ry="68" fill="#686b58" opacity=".11" />
    <path d="M85 427L600 710l515-283v45L600 754 85 472Z" fill="url(#world-earth)" stroke="#aca07c" strokeWidth="2" />
    <path d="M85 427L600 145l515 282L600 710Z" fill="#e1e5c5" stroke="#8e9d7d" strokeWidth="2" />
    <path d="M85 427L600 145l515 282L600 710Z" fill="url(#world-grid)" />
    <path d="M284 318L790 600m-391 0L918 314" stroke="#f9f0d7" strokeWidth="52" opacity=".72" />
    <g aria-hidden="true" fill="#80956d" stroke="#687b5a" strokeWidth="1.5">{[ [180, 440], [1010, 440], [480, 655], [900, 365], [275, 365] ].map(([x,y]) => <g key={x} transform={`translate(${x} ${y})`}><path d="M0 0q-15-28-7-30q12 5 7 30q5-37 14-31q5 9-14 31Z" /></g>)}</g>
    {children}
    <g ref={avatarRef} transform="translate(600 606)" data-testid="world-avatar" className="world-avatar">
      <ellipse cy="24" rx="34" ry="12" fill="none" stroke="#fff8dc" strokeWidth="3" strokeDasharray="5 4" />
      <Ant color={color} scale={1.15} />
      <g transform="translate(0 -58)"><rect x="-32" y="-14" width="64" height="26" rx="13" fill="#fff7df" stroke={INK} strokeWidth="1.5" /><text textAnchor="middle" y="4" fontSize="13" fill={INK}>{emote || "나"}</text></g>
    </g>
    <g aria-hidden="true" transform="translate(595 748)"><text textAnchor="middle" fill="#827a62" fontSize="11" letterSpacing="5">G O K S O R R Y   ·   A N T   W O R L D</text></g>
  </svg>;
}
