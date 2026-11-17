"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { HeaderAccount } from "@/components/auth-controls";
import { HomeFeedShell } from "@/components/home-feed-shell";
import { useMediaQuery } from "@/components/use-media-query";
import { CleanFilterToggle } from "@/components/clean-filter-toggle";
import { FirstVisitHeaderHint } from "@/components/first-visit-header-hint";
import { useCookieConsent } from "@/components/cookie-consent-provider";
import { readClientLocalStorageValue, writeClientLocalStorageValue } from "@/lib/browser-persistence";
import { CLIENT_PERSISTENCE_DEFINITIONS as STORAGE } from "@/lib/persistence-registry";
import { useCleanFilter } from "@/components/clean-filter-provider";
import { useTheme } from "@/components/theme-provider";
import { CHANGE_COLOR_LABELS, renderChangeColorLabel } from "@/components/change-color-label";
import { CHANGE_COLOR_MODES } from "@/lib/change-color-mode";
import { ModeSwitch } from "@/components/mode-switch";
import type { FeedPage, ScopeSummary } from "@/lib/feed-scope";
import type { FeedRow } from "@/lib/feed-data";
import type { GoksorryRoomPayload } from "@/lib/goksorry-room-types";
import type { OverviewPayload } from "@/lib/overview-data";
import { SOURCE_GROUP_IDS, serializeSourceGroupSelection, type SourceGroupId } from "@/lib/feed-source-groups";
import { buildWallModel, WALL_PANELS, type WallPanelId, type WallSection, type WallView } from "@/lib/world-wall";
import { buildWorldFrame, MERGED_SCENES, percent, worldDate, worldDayBounds, worldSceneOf, type WorldFrame, type WorldScene } from "@/lib/world";
import { communityStatus, frameStatus, SIDE_ORDER, WORLD_COLORS } from "@/lib/world-presentation";
import { WorldPanel, type PanelOrigin, type PanelSide } from "./world-panel";
import { PIERROT_DARK } from "./world-pierrot";
import { usePolled } from "./use-wall-data";
import { WorldEvidence } from "./world-evidence";
import { WorldWallDom, SummaryNumbers } from "./world-screens";
import { SceneBoardDom } from "./scene-board-dom";
import type { BoardSource } from "./board-specs";
import { stockPierrotArt } from "@/lib/stock-pierrot";
import type { TheaterTimeline } from "@/lib/world-theater";
import { buildSceneBoard, CAMP_LABEL, stockRanking, type BoardScene } from "@/lib/world-scene-boards";
import { useWorldSound } from "./world-sound";
import { WorldSnackbarProvider, useWorldSnack } from "./world-snackbar";
import type { EvidenceSelection } from "./scene-types";
import "./world.css";

const HD2DWorld = dynamic(() => import("./hd2d-world"), { ssr: false, loading: () => <div className="world-loading">화면 불러오는 중…</div> });
const TheaterControls = dynamic(() => import("./theater").then((module) => module.TheaterControls));
const WorldIndex = dynamic(() => import("./world-index"), { loading: () => <p>지수 여는 중…</p> });
const GoksorryRoom = dynamic(() => import("@/components/goksorry-room/goksorry-room-client").then((module) => module.GoksorryRoomClient), { loading: () => <p>곡소리방 여는 중…</p> });
const EMPTY = buildWorldFrame([], { now: new Date(0) });
// Three rooms: the plaza (wall of indices, feed and the community board of the former 재난방송), the battle (camps of the
// stock picked from the mention ranking of the former 개미 생태계) and the theater.
const SCENES: { id: WorldScene; name: string; short: string; title: string }[] = [
  { id: "plaza", name: "광장", short: "광장", title: "곡소리 지수·커뮤니티 현황·피드" },
  { id: "battle", name: "심리 전장", short: "전장", title: "희망·공포 비교" },
  { id: "theater", name: "오늘의 개미극장", short: "극장", title: "개미극장" }
];
type DetailTab = "index" | "feed" | "room";
const TAB_LABEL: Record<DetailTab, string> = { index: "지수", feed: "피드", room: "곡소리방" };
const PANEL_TAB: Record<WallPanelId, DetailTab> = { market: "index", pierrot: "index", index: "index", feed: "feed", room: "room", communities: "index" };
const SECTION_LABEL = ["시장 지수·곡소리방", "삐에로·곡소리 지수", "곡소리 피드·커뮤니티 현황"];
// A dialog opens on the side of what opened it: by wall section, or by thirds of the stage width.
const SECTION_SIDE: PanelSide[] = ["left", "center", "right"];
const thirdOf = (fraction: number): PanelSide => fraction < 1 / 3 ? "left" : fraction > 2 / 3 ? "right" : "center";
// Height reserved for the bottom scene nav when framing the wall.
const HUD_BOTTOM = 60;
// The feed dialog opens with what used to take one "더 보기" (20 + 20); each further page is this size too.
const FEED_DIALOG_LIMIT = 40;

/** `chatEnabled`: the chat hub is deployed, so the plaza can share the visitor's ant through it. */
/** `menuHeader` tops the menu dialog (the site header without account and theme); `menu` follows the settings (the footer). */
type ShellProps = { timezone: string; selectedGroupIds: SourceGroupId[]; menuHeader: ReactNode; menu: ReactNode; chatEnabled?: boolean };
/** The world page; errors anywhere inside surface as snacks (world-snackbar.tsx). */
export function WorldShell(props: ShellProps) {
  return <WorldSnackbarProvider><WorldShellView {...props} /></WorldSnackbarProvider>;
}

function WorldShellView({ timezone, selectedGroupIds, menuHeader, menu, chatEnabled = false }: ShellProps) {
  const params = useSearchParams();
  const rawScene = params.get("scene");
  const scene = worldSceneOf(rawScene);
  const stock = (params.get("stock") ?? "").toUpperCase();
  const today = worldDate(), firstDate = worldDate(new Date(Date.now() - 6 * 86_400_000));
  const rawDate = params.get("date") ?? today;
  const date = worldDayBounds(rawDate) && rawDate <= today && rawDate >= firstDate ? rawDate : today;
  // `mobile` is only a performance tier now; the wall layout follows the viewport's shape.
  const mobile = useMediaQuery("(pointer: coarse), (max-width: 959px)") === true;
  const landscape = useMediaQuery("(orientation: landscape)");
  const layout = landscape === false ? "sectioned" : "wide";
  const [section, setSection] = useState<WallSection>(1), [overview, setOverview] = useState(false);
  const view = useMemo<WallView>(() => ({ layout, section, overview, hudBottom: HUD_BOTTOM }), [layout, section, overview]);
  const { cleanFilterEnabled } = useCleanFilter();
  // Boards repaint when the change colours do; the font and Pierrot art are fixed (the room has no theme).
  const { changeColorMode, selectChangeColorMode } = useTheme();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)") !== false;
  const { bannerVisible } = useCookieConsent();
  const [frame, setFrame] = useState<WorldFrame>(EMPTY), [replayFrame, setReplayFrame] = useState<WorldFrame | null>(null), [replayCorrected, setReplayCorrected] = useState(false), [replayPending, setReplayPending] = useState(true);
  const [timeline, setTimeline] = useState<TheaterTimeline | null>(null);
  const [origin, setOrigin] = useState<PanelOrigin | null>(null), [roomRefresh, setRoomRefresh] = useState(0);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState("");
  const [visible, setVisible] = useState(true), [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<DetailTab | null>(null), [side, setSide] = useState<PanelSide>("right");
  // Detail of a non-plaza scene's wall board (its list, camps and selection controls).
  const [sceneOrigin, setSceneOrigin] = useState<PanelOrigin | null>(null), [sceneOpen, setSceneOpen] = useState(false);
  // Horizontal position (0..1 of the stage) of the last click in the scene: an ant, a camp, a list button.
  const clickAt = useRef<number | null>(null);
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);
  const [color, setColor] = useState(WORLD_COLORS[0]), [muted, setMuted] = useState(true), [emote, setEmote] = useState("");
  const [reinforcement, setReinforcement] = useState(0), [clock, setClock] = useState(Date.now()), [retry, setRetry] = useState(0);
  const emoteTimer = useRef<ReturnType<typeof setTimeout>>();
  const previousKeys = useRef<{ stock: string; keys: Set<string> } | null>(null);
  const playSound = useWorldSound(muted, !visible, reduced);
  const onStep = useCallback(() => playSound("step"), [playSound]);
  const setUrl = useCallback((key: string, value: string) => {
    const next = new URL(window.location.href); value ? next.searchParams.set(key, value) : next.searchParams.delete(key);
    window.history.pushState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }, []);
  const onScene = useCallback((next: WorldScene) => { setUrl("scene", next === "plaza" ? "" : next); setTab(null); setSceneOpen(false); setSelection(null); playSound("step"); }, [setUrl, playSound]);
  // Links to a merged scene (?scene=ecosystem, ?scene=broadcast) show the scene that took it over; the address follows, keeping ?stock=.
  useEffect(() => {
    if (!rawScene || !Object.prototype.hasOwnProperty.call(MERGED_SCENES, rawScene)) return;
    const next = new URL(window.location.href); scene === "plaza" ? next.searchParams.delete("scene") : next.searchParams.set("scene", scene);
    window.history.replaceState(null, "", `${next.pathname}${next.search}${next.hash}`);
  }, [rawScene, scene]);
  const onDate = useCallback((value: string) => { setReplayFrame(null); setReplayPending(true); setUrl("date", value); }, [setUrl]);
  const onFrame = useCallback((value: WorldFrame | null, corrected: boolean, pending: boolean) => { setReplayFrame(value); setReplayCorrected(corrected); setReplayPending(pending); }, []);
  const open = (next: DetailTab, from: PanelOrigin | null = null, at?: PanelSide) => { setSide(at ?? (from ? thirdOf((from.x + from.width / 2) / window.innerWidth) : "right")); setOrigin(from); setSelection(null); setTab(next); setMenuOpen(false); };
  const evidence = (value: EvidenceSelection) => { setSceneOpen(false); if (!tab) setSide(clickAt.current === null ? "right" : thirdOf(clickAt.current)); setOrigin(null); setSelection(scene === "theater" ? { ...value, recordedAt: shown.generated_at } : value); setTab("feed"); setMenuOpen(false); };
  const close = () => { if (tab === "room") setRoomRefresh((n) => n + 1); setTab(null); if (params.get("feed") === "1") setUrl("feed", ""); };
  // Deep link: ?feed=1 opens the full feed dialog.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("feed") === "1") setTab("feed"); }, []);
  useEffect(() => {
    if (!tab) return;
    const panel = document.querySelector('[data-world-panel="detail"]');
    const active = document.activeElement;
    // Scope selection can hide or remove the initiating control inside a tab.
    if (active === document.body || (active && panel?.contains(active) && active.closest("[hidden]"))) {
      document.getElementById(`world-tab-${tab}`)?.focus();
    }
  }, [tab, selection]);
  useEffect(() => {
    const stored = readClientLocalStorageValue(STORAGE.worldAvatarColor); if (stored && WORLD_COLORS.includes(stored)) setColor(stored);
    setMuted(readClientLocalStorageValue(STORAGE.worldMuted) !== "off");
    const change = () => setVisible(!document.hidden); change(); document.addEventListener("visibilitychange", change);
    return () => { document.removeEventListener("visibilitychange", change); clearTimeout(emoteTimer.current); };
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/internal/world", { signal: controller.signal, cache: "no-store" }); const payload = await response.json();
        if (!response.ok || payload.version !== 1) throw new Error(payload.error ?? "월드 데이터를 불러오지 못했습니다.");
        if (!controller.signal.aborted) { setFrame(payload); setLoaded(true); setClock(Date.now()); setError(""); }
      } catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "조회 실패"); setClock(Date.now()); } }
      finally { if (!controller.signal.aborted && !document.hidden) timer = setTimeout(() => void load(), 60_000); }
    };
    void load(); const clockTimer = setInterval(() => setClock(Date.now()), 30_000);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(clockTimer); };
  }, [visible, retry]);
  useEffect(() => {
    const item = frame.stocks.find((s) => s.symbol === stock), selected = item?.symbol ?? "overall";
    const keys = new Set(Object.values((item ?? frame.overall).evidence).flat().map((r) => r.post_key));
    if (previousKeys.current?.stock === selected) {
      const fresh = [...keys].filter((key) => !previousKeys.current!.keys.has(key)).length; setReinforcement(fresh);
      if (fresh && scene === "battle") playSound("signal");
    }
    previousKeys.current = { stock: selected, keys }; const timer = setTimeout(() => setReinforcement(0), 5000); return () => clearTimeout(timer);
  }, [frame, stock, scene, playSound]);
  // The plaza's community board carries the 재난방송's alert: a short alarm when a community's collection newly needs a look.
  const troubled = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const now = new Set(frame.communities.filter((c) => communityStatus(c).tone === "problem").map((c) => c.id));
    if (troubled.current && scene === "plaza" && [...now].some((id) => !troubled.current!.has(id))) playSound("alarm");
    troubled.current = now;
  }, [frame, loaded, scene, playSound]);
  // Wall data: one light poll per panel. The feed poll also supplies the scoped summary
  // that drives the crowd, lighting and index for a ?channels= / ?stock= selection.
  const plaza = scene === "plaza";
  const channels = serializeSourceGroupSelection(selectedGroupIds);
  const feedWall = usePolled<{ rows: FeedRow[]; summary?: ScopeSummary; stocks?: FeedPage["stocks"] }>(
    plaza ? `/api/feed?${new URLSearchParams({ hours: "6", limit: "12", offset: "0", channels, symbol: stock, asOf: "", sentiment: "all" })}` : null, visible);
  const marketWall = usePolled<OverviewPayload>(plaza ? "/api/internal/overview" : null, visible);
  const roomWall = usePolled<GoksorryRoomPayload>(plaza ? "/api/goksorry-room?limit=6" : null, visible, roomRefresh);
  const wallSummary = plaza ? feedWall.data?.summary : undefined;
  const liveFrame = plaza && wallSummary ? { ...frame, data_at: wallSummary.data_at, overall: { ...frame.overall, ...wallSummary } } : frame;
  const shown = scene === "theater" ? replayFrame ?? EMPTY : liveFrame;
  const item = shown.stocks.find((s) => s.symbol === stock);
  const activeSummary = scene === "battle" && item ? item : shown.overall;
  const status = frameStatus(liveFrame, loaded, error, clock);
  const info = SCENES.find((s) => s.id === scene)!;
  const currentSelection = selection ? { ...selection, summary: selection.symbol ? shown.stocks.find((s) => s.symbol === selection.symbol) ?? EMPTY.overall : selection.community ? shown.communities.find((c) => c.id === selection.community) ?? EMPTY.overall : selection.summary } : null;
  const selectStock = (symbol: string) => setUrl("stock", symbol);
  const openCommunity = (id: SourceGroupId) => { const c = shown.communities.find((value) => value.id === id); if (c) evidence({ title: c.name, summary: c, community: c.id }); };
  // Battle detail: picking a stock re-forms the camps above the list, so bring them back into view with the scope line
  // naming the stock they belong to.
  const battleScopeRef = useRef<HTMLParagraphElement>(null);
  const pickBattleStock = (symbol: string) => { selectStock(symbol); battleScopeRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); };
  // The popup has no title: a new selection (a community, a stock, a camp) is named only by the scope line at the top of
  // the body, so the body starts from the top instead of where the previous view was scrolled to.
  useEffect(() => {
    const body = document.querySelector<HTMLElement>('[data-world-panel="detail"] .world-panel-body');
    if (body) body.scrollTop = 0;
  }, [selection]);
  const filtered = !!stock || selectedGroupIds.length !== SOURCE_GROUP_IDS.length;
  const scopeStatus = !feedWall.loaded && filtered ? "선택 범위 조회 중" : feedWall.failed ? (wallSummary ? "조회 실패 · 마지막 정상 데이터" : "데이터 조회 실패")
    : wallSummary ? frameStatus(liveFrame, true, "", clock) : status;
  const stockOptions = feedWall.data?.stocks ?? frame.stocks;
  const stockName = stockOptions.find((s) => s.symbol === stock)?.name ?? stock;
  const wall = useMemo(() => buildWallModel({
    frame, loaded, failed: !!error, status, scopeStatus, timezone, filtered, cleanFilterEnabled, dark: PIERROT_DARK,
    scopeLabel: stock ? stockName : filtered ? "선택 출처" : "",
    feed: feedWall, market: marketWall, room: roomWall
  }).model, [frame, loaded, error, status, scopeStatus, timezone, filtered, cleanFilterEnabled, stock, stockName, feedWall, marketWall, roomWall]);
  const liveTime = liveFrame.data_at ? `${new Date(liveFrame.data_at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false })} KST` : "";
  const statusLine = liveTime ? `${status} · ${liveTime}` : status;
  const sceneBoard = useMemo(() => plaza ? null : buildSceneBoard({
    scene: scene as BoardScene, frame: shown, loaded, failed: !!error, stock: item, summary: activeSummary, fresh: reinforcement, date, replay: replayFrame, corrected: replayCorrected, pending: replayPending, timeline,
    status: statusLine, art: stockPierrotArt(activeSummary, PIERROT_DARK)
  }), [plaza, scene, shown, loaded, error, item, activeSummary, reinforcement, date, replayFrame, replayCorrected, replayPending, timeline, statusLine]);
  const board = useMemo<BoardSource>(() => plaza ? { kind: "plaza", model: wall } : sceneBoard && { kind: "scene", model: sceneBoard }, [plaza, wall, sceneBoard]);
  const openScene = (from: PanelOrigin) => {
    if (scene === "theater") { if (replayFrame) evidence({ title: "극장 기록", summary: replayFrame.overall, recordedAt: replayFrame.generated_at }); return; }
    setSceneOrigin(from); setTab(null); setMenuOpen(false); setSceneOpen(true);
  };
  const fromButton = (event: { currentTarget: Element }) => event.currentTarget.getBoundingClientRect();
  useWorldSnack("world-data", error ? { text: error, tone: "error", action: { label: "다시 시도", run: () => setRetry((n) => n + 1) } } : null);
  useWorldSnack("world-collection", !error && (frame.collection.errors > 0 || frame.collection.degraded || frame.collection.unavailable) ? { text: "일부 수집·분석 상태 확인 필요", tone: "info" } : null);
  const tabs: DetailTab[] = currentSelection ? ["index", "feed"] : ["index", "feed", "room"];
  const liveBadge = <div className="world-live-badge" data-state={error ? "error" : status.startsWith("갱신") ? "delayed" : "ready"}><i /><span>{status}</span><time dateTime={liveFrame.data_at ?? undefined}>{liveTime}</time></div>;
  return <div className="world-root" data-paused={!visible || reduced} data-scene={scene} data-cookie-banner={bannerVisible} data-layout={landscape === null ? "pending" : layout} data-wall-section={section} data-wall-overview={overview}>
    <div className="world-content" aria-hidden={!!tab || menuOpen || sceneOpen ? true : undefined} ref={node => { if (node) node.inert = !!tab || menuOpen || sceneOpen; }}>
    <header className="world-topbar"><a href="/" className="world-brand"><span className="world-brand-mark" aria-hidden="true" /><Image className="world-brand-logo" src="/goksorry_logo.png" alt="곡소리닷컴" width={113} height={50} priority /></a>
      {liveBadge}
      <div className="world-hud-actions"><button className="world-index-toggle" onClick={(event) => open("index", fromButton(event))}>지수</button><button className="world-feed-toggle" onClick={(event) => open("feed", fromButton(event))}>피드</button><ModeSwitch /><button className="world-menu-button" aria-label="메뉴" aria-expanded={menuOpen} onClick={() => { setTab(null); setMenuOpen(true); }}><span className="world-menu-label">메뉴</span><span aria-hidden="true">☰</span></button></div>
      <div className="world-account"><HeaderAccount /></div>
    </header>
    <div className="world-scene-stage" aria-busy={!loaded && !error} onClickCapture={(event) => {
      const bounds = event.currentTarget.getBoundingClientRect(), target = (event.target as Element).getBoundingClientRect();
      // Keyboard activation carries no pointer position; use the control itself.
      clickAt.current = bounds.width ? ((event.detail === 0 ? target.left + target.width / 2 : event.clientX) - bounds.left) / bounds.width : null;
    }}>
      <div className="world-scene-heading"><h1 className="sr-only">{info.title}</h1></div>
      <HD2DWorld frame={shown} absent={scene === "theater" && !replayFrame} pending={scene === "theater" && replayPending} scene={scene} stock={stock} mobile={mobile} reduced={reduced} paused={!visible} color={color} emote={emote} board={board} view={view} styleKey={changeColorMode} shared={chatEnabled} onStep={onStep} onScene={onScene} onSection={setSection}>
        {plaza && <WorldWallDom model={wall} onOpen={(panel, rect) => open(PANEL_TAB[panel], rect, SECTION_SIDE[WALL_PANELS[panel].section])} onCommunity={openCommunity} onFocusPanel={(panel) => { if (layout === "sectioned") setSection(WALL_PANELS[panel].section); }} />}
        {plaza && landscape === false && <div className="world-wall-nav">
          <button className="world-wall-arrow" data-dir="left" hidden={overview} aria-disabled={section === 0} aria-label={`왼쪽 벽 보기 · ${SECTION_LABEL[Math.max(0, section - 1)]}`} onClick={() => setSection((value) => Math.max(0, value - 1) as WallSection)}>‹</button>
          <button className="world-wall-zoom" aria-pressed={overview} onClick={() => setOverview((value) => !value)}>{overview ? "확대" : "전체보기"}</button>
          <button className="world-wall-arrow" data-dir="right" hidden={overview} aria-disabled={section === 2} aria-label={`오른쪽 벽 보기 · ${SECTION_LABEL[Math.min(2, section + 1)]}`} onClick={() => setSection((value) => Math.min(2, value + 1) as WallSection)}>›</button>
        </div>}
        {sceneBoard && <SceneBoardDom model={sceneBoard} onOpen={openScene} />}
      </HD2DWorld>
      {scene === "theater" && <TheaterControls key={date} date={date} onDate={onDate} onFrame={onFrame} onTimeline={setTimeline} paused={!visible || !!tab || menuOpen} reduced={reduced} color={color} />}
      <footer className="world-bottom"><nav aria-label="월드 장면 선택">{SCENES.map((s, i) => <button key={s.id} aria-label={s.name} aria-current={scene === s.id ? "page" : undefined} onClick={() => onScene(s.id)}><span>0{i + 1}</span><b>{layout === "sectioned" ? s.short : s.name}</b></button>)}</nav></footer>
    </div>
    </div>
    {tab && <WorldPanel title={currentSelection ? `${currentSelection.title} · 분위기와 근거` : "전체 커뮤니티 · 지수와 피드"} name="detail" modal origin={origin} side={side} onClose={close}
      bar={<div className="world-detail-bar"><div className="world-detail-tabs" role="tablist" aria-label="정보 전환">{tabs.map((value, i) => <button key={value} id={`world-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`world-tabpanel-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? tabs[0] : e.key === "End" ? tabs[tabs.length - 1] : tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; setTab(next); document.getElementById(`world-tab-${next}`)?.focus(); } }}>{TAB_LABEL[value]}</button>)}</div>{currentSelection && <button className="world-reset-selection" onClick={() => setSelection(null)}>전체 보기</button>}</div>}>
      {currentSelection && <div className="world-selected-summary"><p className="world-selected-scope">{currentSelection.title} · 최근 6시간 분석 표본</p><SummaryNumbers summary={currentSelection.summary} /></div>}
      <div id="world-tabpanel-index" role="tabpanel" aria-labelledby="world-tab-index" hidden={tab !== "index"}>
        {!currentSelection && <WorldIndex selectedGroupIds={selectedGroupIds} />}
        <section className="world-detail-communities" aria-labelledby="world-communities-heading"><h3 id="world-communities-heading">커뮤니티 현황</h3>
          <div className="world-community-list">{shown.communities.map((c) => { const status = communityStatus(c); return <button key={c.id} data-tone={status.tone} onClick={() => openCommunity(c.id)}><strong>{c.name}</strong><span>{c.total ? `${c.index.toFixed(1)} / 10` : "— / 10"} · 표본 {c.total}건</span><span>공포 {percent(c.fear_ratio)} · 희망 {percent(c.hope_ratio)}</span><span>{status.text}</span></button>; })}</div></section>
        <p className="world-footnote">희망·공포 비율은 중립을 제외한 글 건수 비율입니다. 곡소리 지수는 기존 감성 점수·커뮤니티 보정 산식으로 계산하며 비율과 다릅니다. 표본 부족·빈 결과는 안정이나 시장 전체를 뜻하지 않습니다.</p>
      </div>
      <div id="world-tabpanel-feed" role="tabpanel" aria-labelledby="world-tab-feed" hidden={tab !== "feed"}>
        {currentSelection ? <WorldEvidence key={`${currentSelection.title}-${currentSelection.side ?? "all"}-${currentSelection.recordedAt ?? ""}`} selection={currentSelection} selectedGroupIds={selectedGroupIds} />
          : <HomeFeedShell timezone={timezone} selectedGroupIds={selectedGroupIds} windowHours={6} initialLimit={FEED_DIALOG_LIMIT} embedded scope={stock ? { symbol: stock } : undefined} viewControlsEnd={<CleanFilterToggle />}
            scopeControl={stock ? <button type="button" className="world-feed-scope" aria-label={`${stockName} 종목 범위 해제`} onClick={() => selectStock("")}><span>종목</span><b>{stockName}</b><span aria-hidden="true">✕</span></button> : undefined} />}
      </div>
      {!currentSelection && <div id="world-tabpanel-room" role="tabpanel" aria-labelledby="world-tab-room" hidden={tab !== "room"}>{tab === "room" && <GoksorryRoom />}</div>}
    </WorldPanel>}
    {sceneOpen && scene === "battle" && <WorldPanel title={info.title} name="scene" modal origin={sceneOrigin} side="center" onClose={() => setSceneOpen(false)}>
      <div className="world-battle-detail">
        <p className="world-battle-scope" ref={battleScopeRef}>전장 종목 · <b>{item?.name ?? "전체 커뮤니티"}</b></p>
        <div className="world-camps">{SIDE_ORDER.map((side) => <button key={side} data-side={side} onClick={() => evidence({ title: `${item?.name ?? "전체"} ${CAMP_LABEL[side]}`, summary: activeSummary, symbol: item?.symbol, side })}><span>{CAMP_LABEL[side]}</span><strong>{side === "neutral" ? `${activeSummary.neutral}건` : percent(side === "bullish" ? activeSummary.hope_ratio : activeSummary.fear_ratio)}</strong><span>{side === "neutral" ? "비율에서 별도" : `${activeSummary[side]}건`} · 근거 보기 ↗</span></button>)}</div>
        <section className="world-battle-stocks" aria-labelledby="world-battle-stocks-heading"><h3 id="world-battle-stocks-heading">전장 종목 · 최근 6시간 언급 순위</h3>
          <div className="world-stock-list" role="group" aria-label="전장 종목">
            <button aria-pressed={!item} onClick={() => pickBattleStock("")}><span className="world-rank" aria-hidden="true">—</span><strong>전체 커뮤니티</strong><span>{shown.overall.total}건 · 희망 {percent(shown.overall.hope_ratio)}</span></button>
            {stockRanking(shown.stocks, item?.symbol ?? "").map((s) => <button key={s.symbol} aria-pressed={s.selected} aria-label={`${s.name} · ${s.count}`} onClick={() => pickBattleStock(s.symbol)}><span className="world-rank">{s.rank}</span><strong>{s.name}</strong><span>{s.count} · {s.hope}</span><small>{s.verdict}</small></button>)}
          </div>
          {!shown.stocks.length && <p className="world-note">분석된 종목이 없습니다. 새 표본을 기다리고 있습니다.</p>}
        </section>
        {sceneBoard?.scene === "battle" && <p className="world-footnote">{sceneBoard.note}</p>}
      </div>
    </WorldPanel>}
    {menuOpen && <WorldPanel title="사이트 메뉴·출처·정책" name="menu" modal onClose={() => setMenuOpen(false)}>{menuHeader}<FirstVisitHeaderHint inWorldMenu />
      <section className="world-settings"><h3>내 개미와 소리</h3><fieldset><legend className="sr-only">내 개미 색상</legend>{WORLD_COLORS.map((value, i) => <button key={value} aria-label={`내 개미 색상 ${i + 1}`} aria-pressed={color === value} style={{ background: value }} onClick={() => { setColor(value); writeClientLocalStorageValue(STORAGE.worldAvatarColor, value); }} />)}</fieldset><div className="world-emotes">{["♡", "ㅠㅠ", "존버"].map((value) => <button key={value} aria-label={`${value} 감정 표현`} onClick={() => { setEmote(value); clearTimeout(emoteTimer.current); emoteTimer.current = setTimeout(() => setEmote(""), 2400); }}>{value}</button>)}</div><button aria-label={muted ? "효과음 켜기" : "효과음 끄기"} aria-pressed={!muted} onClick={() => { const next = !muted; setMuted(next); writeClientLocalStorageValue(STORAGE.worldMuted, next ? "on" : "off"); }}>{muted ? "효과음 켜기" : "효과음 끄기"}</button></section>
      <section className="world-settings world-change-color" aria-labelledby="world-change-color-heading"><h3 id="world-change-color-heading">등락률 색상</h3><div role="group" aria-labelledby="world-change-color-heading">{CHANGE_COLOR_MODES.map((mode) => <button key={mode} aria-label={`등락률 색상 ${CHANGE_COLOR_LABELS[mode]}`} aria-pressed={changeColorMode === mode} onClick={() => selectChangeColorMode(mode)}>{renderChangeColorLabel(mode)}</button>)}</div></section>{menu}
    </WorldPanel>}
  </div>;
}
