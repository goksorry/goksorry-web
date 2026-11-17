import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldFrame, WorldScene, WorldSide, WorldSummary } from "@/lib/world";
import { CAMP_X, crowdCapacity, crowdDistribution } from "@/lib/world-presentation";
import { WALK_PHASE, antFrameCandidates, antGazePose, antWalkFrame, createCrowd, facing8, leanOf, viewHalf, walkLift, walkPose, type AntPose, type AntVariant, type CrowdDoor, type CrowdMember, type CrowdView } from "@/lib/world-crowd";
import { fakeCapacity } from "@/lib/world-presence";
import type { PlazaPeer } from "@/lib/chat-types";
import { PLAZA_DOOR, PLAZA_ENTRANCES, WORLD_BOUNDS, entranceAt, findWorldPath, plazaDoorWay, walkable, worldObstacles, type Point } from "@/lib/world-navigation";
import { WALL_COS, WALL_FACE_Z, WALL_PANEL_Z, WALL_SECTION_X, WALL_SHORT_STAGE, sceneBoardLayout, wallBodyPx, wallFit, wallScreenY, type WallFit, type WallRect, type WallSection, type WallView } from "@/lib/world-wall";
import { stockPierrotArt } from "@/lib/stock-pierrot";
import { createBoardLayer, type BoardSpec } from "./board-layer";
import { createLabelLayer, type LabelSpec } from "./label-layer";
import { createMoveMarker, type MoveMarkerState } from "./move-marker";
import { castFade } from "@/lib/world-theater";
import { SIDE_VARIANT, battlePose, createBattleCrowd, emoteFrames } from "@/lib/world-battle-crowd";
import antAtlas from "./ant-atlas.json";

/** `paused` stops everything (hidden tab); `reduced` (prefers-reduced-motion) keeps the visitor's own walk but stops ambient motion. */
export type RenderState = { frame: WorldFrame; scene: WorldScene; stock: string; mobile: boolean; color: string; paused: boolean; reduced: boolean;
  /** Theater: no record can be shown for this slot. The ants of the last shown record fade out (instead of vanishing) and the next record's fade in. */
  absent?: boolean };
export type WallMetrics = { rects: Record<string, WallRect>; drawn: Record<string, string>; /** Boards showing the loading sweep, read live. */ readonly shimmer: string[]; body: number; ppu: number; section: number; overview: boolean; settled: boolean; front: number; yaw: number;
  /** Zoomed section view only: whether the frame is following the visitor (false while it walks to a section chosen by hand), and how far it is panned off the section's centre for it (world units). */
  follow: boolean; pan: number;
  /** Screen bounds of each plaza doorway's opening, by scene. */
  doors: Record<string, WallRect> };
export type RenderMetrics = { renders: number; frames: number[]; cpu: number[]; gpu: number[]; calls: number; triangles: number; renderer: string; population: number; wall: WallMetrics | null;
  /** Atlas image this renderer loaded: the full one or the reduced copy for small screens. */
  atlas: string;
  /** Breath puffs drawn in the last frame (one per ant in the middle of a sigh; none for the relieved pose of a hopeful index). */
  puffs: number;
  /** Sprite scale of this frame (see ANT_VIEW): 1 on wide views, down to ANT_SMALL on a zoomed phone view. */
  antSize: number;
  /** Opacity the battle and theater ants (not the visitor) were drawn at last frame, 0..1: the theater fades them out where no record can be shown. */
  cast: number;
  /** Band of the 곡소리 지수 the plaza wall shows (as the index panel labels it), and whether the ants wear their bright faces for it (희망, 극단적 희망). */
  band: string; bright: boolean;
  /** 심리 전장 camp ants (empty elsewhere): their camp side and spot (see campSpots), "walk" / "stand" / "emote" (with the loop
   * playing), whether they are walking off, and how much of them is drawn. */
  battle: () => (AntMetric & { id: string; side: WorldSide; spot: number; leaving: boolean; emote: string | null; fade: number })[];
  /** Plaza crowd ants, NPCs and other viewers' (empty elsewhere): floor position, state, 8-way facing (ANT_DIRS index) and screen point of the body;
   * the turnover phase it is in (`trip`), how many trips its slot has made (`lap`) and how much of it is drawn (`fade`, 0 hidden). */
  crowd: () => (AntMetric & { id: string; peer: boolean; leaving: boolean; trip: "out" | "away" | "in" | null; lap: number; fade: number })[];
  /** The visitor's ant, in every scene. */
  visitor: () => AntMetric;
  /** The ring a floor click left at the visitor's walk target, drawn last frame (null when none): floor point, look, and screen point of its centre. */
  marker: () => (MoveMarkerState & { sx: number; sy: number }) | null };
/** `frame` is the atlas frame drawn last ("key", or "key~" when mirrored; empty outside the plaza); `sh` is the sprite's height on screen in CSS px;
 * `unit` is the size it was drawn at, in world units per atlas pixel (so a length measured in the art times `unit` is a length on the floor). */
export type AntMetric = Point & { state: string; dir: number; sx: number; sy: number; sh: number; frame: string; unit: number };
export type WorldRenderer = {
  update: (state: RenderState) => void;
  setView: (view: WallView) => void;
  /** Boards on the current scene's back wall (see board-specs.ts); an empty list hides them. */
  setBoards: (specs: BoardSpec[]) => void;
  /** Mood band the wall shows (for the plaza faces); null derives it from the frame. */
  setBand: (band: string | null) => void;
  wallTexture: (id: string) => HTMLCanvasElement | undefined;
  /** Text over the visitor's head ("나" or an emote); null leaves it off (the static fallback art). */
  setVisitorTag: (text: string | null) => void;
  /** Page font for painted labels. */
  setFont: (family: string) => void;
  move: (x: number, z: number) => void;
  click: (x: number, y: number) => void;
  /** Other viewers in this plaza room; their ants walk in, follow the points they share and walk off when they go. */
  setPeers: (peers: PlazaPeer[]) => void;
  /** A peer chatted: its ant looks at its phone for `seconds`. */
  say: (id: string, seconds: number) => void;
  draw: (time?: number) => void;
  capture: (frame: WorldFrame) => Promise<HTMLCanvasElement>;
  dispose: () => void;
  metrics: RenderMetrics;
  position: Point;
};

/** Ant instances: the plaza holds at most about 20 NPCs, 19 peers, a few ants walking off and the visitor; the battle 20 camp
 * ants, at most 20 walking off, 19 peers and the visitor; the theater 47. */
const MAX_ANTS = 64;

export async function createWorldRenderer(canvas: HTMLCanvasElement, initial: RenderState, events: {
  panels?: (rects: Record<string, WallRect> | null) => void;
  avatar?: (x: number, y: number, position: Point) => void;
  step?: () => void;
  /** The zoomed section view wants to show another wall section because the visitor walked into it. The owner of the view answers with setView. */
  section?: (section: WallSection) => void;
  failure?: () => void;
  /** Screen rectangles of the text tags (visitor, plaza entrances) whenever they move, for their DOM twins. */
  labels?: (rects: Record<string, WallRect>) => void;
  /** The visitor set off for a new floor point (a click or an arrow key), for presence. */
  walk?: (target: Point) => void;
  /** Every plaza and battle frame: the screen point over each peer ant's name tag, for its speech bubble. */
  peers?: (heads: Record<string, { x: number; y: number }>) => void;
  /** The visitor clicked the plaza door it stands at. */
  enter?: (scene: WorldScene) => void;
} = {}): Promise<WorldRenderer> {
  let state = initial;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0c141a);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x101b23, 34, 68);
  // Perspective camera with a level axis and a shifted frustum (lens shift): at rest the wall plane
  // maps exactly like the old orthographic frame, so panels stay rectangles, while depth gets real
  // perspective. The camera orbits the wall around the vertical axis to keep looking toward the visitor.
  const camera = new THREE.PerspectiveCamera();
  const hemi = new THREE.HemisphereLight(0x9ebbd0, 0x3a2c21, 2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xb8c6d0, 2.5); sun.position.set(-8, 18, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -14; sun.shadow.bias = -.002;
  scene.add(sun);
  const amber = new THREE.PointLight(0xe8ad60, 50, 19, 2); amber.position.set(-6, 5, -1); scene.add(amber);
  const warning = new THREE.PointLight(0xdb604b, 24, 14, 2); warning.position.set(7, 4, -1); scene.add(warning);
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const geometry: THREE.BufferGeometry[] = [];
  const loader = new THREE.TextureLoader();
  // The atlas comes in two sizes with the same layout (frames are addressed in fractions of the image). The reduced one
  // is two thirds of the full one: enough wherever an ant is drawn at no more than two thirds of a framebuffer pixel
  // per atlas pixel. Measured for the visitor, the largest sprite, standing mid-floor: .55 on a 390 px wide portrait
  // phone at pixel ratio 2 (.00071 x the framebuffer width) and .51 on a 1440 px wide whole-wall view (.00036 x). So the
  // reduced atlas serves screens up to 860 by 1900 device pixels (pixel ratio capped at 2 as in resize()): phones in
  // either orientation, not tablets or desktops. It is decided once from the screen, not the window, so resizing never
  // needs a second download.
  const small = (antAtlas as { small?: { image: string } }).small, ratio = Math.min(window.devicePixelRatio || 1, 2);
  const atlasImage = small && Math.min(screen.width, screen.height) * ratio <= 860 && Math.max(screen.width, screen.height) * ratio <= 1900 ? small.image : antAtlas.image;
  let source: THREE.Texture, atlas: THREE.Texture;
  try { [source, atlas] = await Promise.all((["/world/materials.png", atlasImage]).map((url) => loader.loadAsync(url).then((t) => { textures.push(t); return t; }))); }
  catch (error) { textures.forEach((t) => t.dispose()); renderer.dispose(); throw error; }
  for (const texture of textures) { texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; }
  const tile = (column: number, row: number, repeat = 1) => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = false;
    const image = source.image as HTMLImageElement;
    ctx.drawImage(image, column * image.width / 2, row * image.height / 2, image.width / 2, image.height / 2, 0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); textures.push(texture); return texture;
  };
  const material = (map: THREE.Texture | null, color: number, emissive = 0) => {
    const m = new THREE.MeshLambertMaterial({ map, color, emissive }); materials.push(m); return m;
  };
  const floorMat = material(tile(0, 0, 5), 0x91a2ab), brickMat = material(tile(1, 0, 2), 0xb1b9bf);
  const metalMat = material(tile(0, 1), 0x9e896f), plasterMat = material(tile(1, 1), 0x788b94);
  const darkMat = material(null, 0x121b20), woodMat = material(tile(0, 1), 0x685340);
  const paperMat = material(tile(1, 1), 0xb3a991), glowMat = material(null, 0xe2b87c, 0x67401b);
  const redMat = material(null, 0xb46450, 0x3e110a), curtainMat = material(tile(0, 1), 0x52383c);
  const goldMat = material(tile(0, 1), 0xd2ad66, 0x2a1c08);
  const staticRoot = new THREE.Group(); scene.add(staticRoot);
  let room = new THREE.Group(); staticRoot.add(room);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, target = room) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; target.add(o); return o;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, target = room) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, target);
  const arch = (x: number, z: number, width: number, height: number) => {
    const shape = new THREE.Shape(); const r = width / 2;
    shape.moveTo(-r, 0); shape.lineTo(-r, height - r); shape.absarc(0, height - r, r, Math.PI, 0, true); shape.lineTo(r, 0); shape.lineTo(-r, 0);
    mesh(new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: false, curveSegments: 10 }), darkMat, x, .02, z);
    for (let i = 0; i < 9; i++) {
      const angle = i / 8 * Math.PI;
      const stone = box(x + Math.cos(angle) * (r + .13), height - r + Math.sin(angle) * (r + .13), z + .08, .38, .35, .35, plasterMat);
      stone.rotation.z = angle;
    }
    for (const sign of [-1, 1]) box(x + sign * (r + .16), (height - r) / 2, z + .1, .32, height - r, .4, plasterMat);
  };
  /** UVs from world position, picked by face direction (geometry already in place): split pieces continue one brick or plaster
   * pattern. `s*` are the tile's world size along x, y and z, `o*` its origin. */
  const planarUV = (g: THREE.BufferGeometry, sx: number, sy: number, sz: number, ox = 0, oy = 0, oz = 0) => {
    const p = g.getAttribute("position"), n = g.getAttribute("normal"), uv = g.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      const x = (p.getX(i) - ox) / sx, y = (p.getY(i) - oy) / sy, z = (p.getZ(i) - oz) / sz;
      if (Math.abs(n.getZ(i)) > .5) uv.setXY(i, x, y); else if (Math.abs(n.getX(i)) > .5) uv.setXY(i, z, y); else uv.setXY(i, x, z);
    }
    return g;
  };
  /** Pieces of [lo, hi] left between the cuts (sorted, inside the range). */
  const spans = (lo: number, hi: number, cuts: [number, number][]) => {
    const out: [number, number][] = []; let at = lo;
    for (const [a, b] of cuts) { if (a > at) out.push([at, a]); at = Math.max(at, b); }
    if (hi > at) out.push([at, hi]); return out;
  };
  // A slab laid in world space with planar UVs (see planarUV), for split plinths and steps.
  const slab = (x0: number, x1: number, y: number, z: number, h: number, d: number, m: THREE.Material, tile: [number, number, number, number, number, number]) =>
    mesh(planarUV(new THREE.BoxGeometry(x1 - x0, h, d).translate((x0 + x1) / 2, y, z), ...tile), m, 0, 0, 0);
  // Per-room look through each plaza doorway, on the recess's back plate: only its lower .7 shows under the name plate.
  const glimpse = (scene: string, x: number, z: number) => {
    if (scene === "theater") { box(x, .4, z, 1, .8, .02, curtainMat); box(x, .08, z + .02, 1, .06, .02, goldMat); }
    // The battle: its two camp flags, fear (red) on the left and hope (amber) on the right as on the field.
    else { box(x, .4, z, 1, .8, .02, metalMat); box(x - .24, .5, z + .02, .34, .2, .02, redMat); box(x + .24, .5, z + .02, .34, .2, .02, glowMat); }
  };
  /** The plaza's back wall between x ±11.2, with a low doorway cut under each panel column (see PLAZA_DOOR): framed by plaster
   * jambs and a metal lintel, a name plate across the top of the opening, and a dark recess behind it, wider than the opening so
   * a turned camera never looks past it into the void. The plinth and the steps stop at each door, so the floor runs in. */
  function plazaWall() {
    const { half, height, lintel, plate } = PLAZA_DOOR, doors = [...PLAZA_ENTRANCES].sort((a, b) => a.x - b.x), jamb = .22, back = WALL_FACE_Z - .65;
    // One notched outline, no holes: earcut needs holes strictly inside the outline, and these touch the floor.
    const shape = new THREE.Shape(); shape.moveTo(-11.2, 0);
    for (const e of doors) { shape.lineTo(e.x - half, 0); shape.lineTo(e.x - half, height); shape.lineTo(e.x + half, height); shape.lineTo(e.x + half, 0); }
    shape.lineTo(11.2, 0); shape.lineTo(11.2, 9); shape.lineTo(-11.2, 9);
    // Same brick scale and seams as the 11.2 x 9 wall boxes on either side.
    mesh(planarUV(new THREE.ExtrudeGeometry(shape, { depth: .65, bevelEnabled: false }).translate(0, 0, back), 11.2, 9, 11.2), brickMat, 0, 0, 0);
    const cuts = doors.map((e): [number, number] => [e.x - half - jamb, e.x + half + jamb]);
    for (const [x0, x1] of spans(-10.6, 10.6, cuts)) slab(x0, x1, .4, -4.2, .8, 1.5, plasterMat, [21.2, .8, 1.5, -10.6, 0, -4.95]);
    for (let j = 0; j < 3; j++) for (const [x0, x1] of spans(-9.9, 9.9, cuts)) slab(x0, x1, .1 + j * .12, -3.3 - j * .32, .2, .45, brickMat, [19.8, .2, .45, -9.9, j * .12, -3.525 - j * .32]);
    for (const e of doors) {
      for (const sign of [-1, 1]) {
        box(e.x + sign * (half + jamb / 2), height / 2, WALL_FACE_Z + .08, jamb, height, .26, plasterMat);
        box(e.x + sign * (half + jamb / 2), height - plate - .09, WALL_FACE_Z + .23, .09, .09, .05, glowMat); // lamps under the plate
        box(e.x + sign * 1.5, 1.1, back - .375, .1, 2.2, .75, darkMat); // recess cheeks
      }
      box(e.x, height + lintel / 2, WALL_FACE_Z + .08, 2 * (half + jamb) + .06, lintel, .26, metalMat);
      // Name plate hung over the lintel and the top of the opening; its painted label (style "sign") stands in front of it.
      box(e.x, height + (lintel - plate) / 2 + .01, PLATE_Z, 2 * (half + jamb) + .02, plate + lintel + .02, .05, metalMat);
      box(e.x, .02, WALL_FACE_Z + .2, 2 * half + .1, .04, .5, plasterMat); // threshold
      box(e.x, 1.1, back - .85, 3.1, 2.2, .2, darkMat); // recess back
      // The recess floor stays dark: the plaza lights would otherwise light the floor tiles inside.
      box(e.x, .006, back - .1, 2.9, .01, 1.95, darkMat).castShadow = false;
      glimpse(e.scene, e.x, back - .74);
    }
  }
  const cable = (points: THREE.Vector3[]) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .035, 4, false), darkMat, 0, 0, 0);
  function buildRoom() {
    room.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); staticRoot.remove(room); room = new THREE.Group(); staticRoot.add(room);
    // Frontal stage: one flat 9-high back wall carries the information panels.
    // Floor and brick repeat past the side walls so wide viewports never show void.
    // The follow camera pans sideways and swings the frame's lower corners forward, so the wall runs
    // as wide as the floor and a front strip continues the floor toward the camera.
    for (const x of [-23, 0, 23]) { box(x, -.38, 0, 23, .75, 17, floorMat); box(x, -.38, 10.5, 23, .75, 4, floorMat); }
    const plaza = state.scene === "plaza";
    for (const x of [-28, -16.8, ...(plaza ? [] : [-5.6, 5.6]), 16.8, 28]) box(x, 4.5, -5.3, 11.2, 9, .65, brickMat);
    box(0, 9.12, -5.2, 68, .24, 1.1, metalMat);
    if (plaza) plazaWall();
    else {
      box(0, .4, -4.2, 21.2, .8, 1.5, plasterMat);
      for (let j = 0; j < 3; j++) box(0, .1 + j * .12, -3.3 - j * .32, 19.8, .2, .45, brickMat);
    }
    for (const sign of [-1, 1]) {
      box(sign * 11.2, 2.1, 0, .7, 4.8, 11, brickMat);
      // Low side buildings stay below the panel bottoms from the camera's view.
      box(sign * 9.6, 1.1, -1, 2.5, 2.2, 3.4, brickMat);
      box(sign * 9.6, 2.3, -1, 3, .24, 4, metalMat);
      arch(sign * 9.2, .76, 1.25, 1.8);
      box(sign * 3.5, 8.95, -4.5, .36, .45, .35, glowMat);
      box(sign * 3.5, 8.66, -4.6, .5, .1, .6, metalMat);
      const pipe = mesh(new THREE.CylinderGeometry(.07, .07, 5.2, 6), metalMat, sign * 10.8, 2.6, -4.7);
      pipe.castShadow = false;
    }
    // Board frames are lit scenery; the board faces themselves are separate unlit meshes (board-layer.ts).
    for (const [id, p] of Object.entries(sceneBoardLayout(state.scene))) {
      const portrait = id === "pierrot";
      box(p.x, p.y, -4.94, p.w + (portrait ? .5 : .24), p.h + (portrait ? .5 : .24), .1, portrait ? goldMat : metalMat);
    }
    if (!plaza) {
      arch(0, -4.9, 2.3, 3.4);
      box(0, 4.3, -4.65, 2.9, .8, .18, metalMat);
      for (let i = 0; i < 5; i++) box(-.9 + i * .45, 4.3, -4.5, .14, .1, .02, glowMat);
    }
    cable([new THREE.Vector3(-11, 10.1, -3.4), new THREE.Vector3(-3, 9.7, -2.9), new THREE.Vector3(4, 9.9, -3), new THREE.Vector3(11, 10.2, -3.5)]);
    // Lived-in details, kept outside walkable routes.
    for (let i = 0; i < 8; i++) {
      const x = (i % 2 ? -1 : 1) * (8 + i % 3 * .45), z = 2.6 + (i % 3) * .4;
      box(x, .25, z, .7, .5, .5, woodMat);
      box(x, .51, z, .08, .03, .53, metalMat);
    }
    for (let i = 0; i < 18; i++) {
      const paper = box(-9 + (i * 47 % 180) / 10, .018, -2 + (i * 31 % 85) / 10, .24, .012, .34, paperMat);
      paper.rotation.y = i * 2.4; paper.castShadow = false;
    }
    for (let i = 0; i < 8; i++) box(-4 + i * 1.1, .006, 5.8, .65, .008, .06, metalMat);
    if (state.scene === "battle") {
      for (let i = 0; i < 4; i++) { const p = box(0, .7, -.9 + i * .7, .65, 1.25, .5, woodMat); p.rotation.z = (i % 2 ? 1 : -1) * .15; }
      // Camp flags: red over the fear camp, amber over the hope camp, each on its CAMP_X side.
      for (const side of ["bearish", "bullish"] as const) { const sign = CAMP_X[side]; box(sign * 5.5, 1.8, -.5, .08, 3.6, .08, metalMat); box(sign * 5.1, 3.2, -.5, .8, .6, .04, side === "bullish" ? glowMat : redMat); }
    } else if (state.scene === "theater") {
      box(0, .35, -2, 10, .7, 3, woodMat);
      for (const sign of [-1, 1]) for (let i = 0; i < 5; i++) box(sign * (4.5 - i * .24), 2.7, -2.8 + i * .09, .3, 4.5, .4, curtainMat);
      for (let i = 0; i < 10; i++) { const x = -6 + i % 5 * 3, z = 4.5 + Math.floor(i / 5) * 1.7; box(x, .3, z, 1.2, .4, .65, woodMat); box(x, .75, z + .35, 1.2, .9, .15, curtainMat); }
    }
    // Merge static architecture by material. Sprite crowd remains one instanced draw.
    room.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    room.traverse((o) => { if (o instanceof THREE.Mesh) { const m = o.material as THREE.Material; const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld); groups.set(m, [...(groups.get(m) ?? []), g]); o.geometry.dispose(); } });
    room.clear();
    for (const [m, gs] of groups) { const g = mergeGeometries(gs); gs.forEach((v) => v.dispose()); if (g) mesh(g, m, 0, 0, 0); }
    renderer.shadowMap.needsUpdate = true;
  }
  // Wall boards: unlit textured planes on the back wall, never merged with the room.
  const boards = createBoardLayer({ z: WALL_PANEL_Z, anisotropy: Math.min(4, renderer.capabilities.getMaxAnisotropy()), loader, onImage: () => { if (!disposed) draw(); } });
  scene.add(boards.group);
  let band: string | null = null;
  // Text tags over the scene: the visitor's name/emote and the plaza's entrance signs.
  const labels = createLabelLayer(); scene.add(labels.group);
  let visitorTag: string | null = "나", labelKey = "";
  // Where a floor click sent the visitor: a ring on the ground until it gets there.
  const marker = createMoveMarker(); scene.add(marker.mesh);
  const antGeometry = new THREE.PlaneGeometry(1, 1);
  const offsets = new Float32Array(MAX_ANTS * 4);
  antGeometry.setAttribute("atlasRect", new THREE.InstancedBufferAttribute(offsets, 4));
  // Per-instance opacity of the ants (1 = solid). The sprites are alpha-tested and opaque, so a fade is an ordered 4x4
  // dither: pixels drop out evenly as it falls, and the crowd never needs depth sorting.
  const fades = new Float32Array(MAX_ANTS).fill(1);
  antGeometry.setAttribute("antFade", new THREE.InstancedBufferAttribute(fades, 1));
  const antMaterial = new THREE.MeshBasicMaterial({ map: atlas, alphaTest: .35, side: THREE.DoubleSide });
  const atlasShader = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 atlasRect;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = uv * atlasRect.zw + atlasRect.xy;");
  };
  antMaterial.onBeforeCompile = (shader) => {
    atlasShader(shader);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float antFade;\nvarying float vAntFade;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvAntFade = antFade;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
varying float vAntFade;
const float ANT_BAYER[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);`)
      .replace("#include <alphatest_fragment>", `#include <alphatest_fragment>
if (vAntFade < .999) { ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.)); if ((ANT_BAYER[cell.y * 4 + cell.x] + .5) / 16. > vAntFade) discard; }`);
  };
  antMaterial.customProgramCacheKey = () => "world-ant-atlas-v2"; materials.push(antMaterial); geometry.push(antGeometry);
  const ants = new THREE.InstancedMesh(antGeometry, antMaterial, MAX_ANTS); ants.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ants.frustumCulled = false; scene.add(ants);
  const shadowGeometry = new THREE.CircleGeometry(.46, 12); geometry.push(shadowGeometry);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x04090d, transparent: true, opacity: .36, depthWrite: false }); materials.push(shadowMaterial);
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, MAX_ANTS); shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shadows.frustumCulled = false; scene.add(shadows);
  // Plaza cues: a phone screen (only when the phone pose had to fall back to a frame without a phone) and the breath of a sigh
  // (not of the relieved pose that replaces the sigh while the index is hopeful).
  const cueCanvas = document.createElement("canvas"); cueCanvas.width = 32; cueCanvas.height = 16;
  const cueContext = cueCanvas.getContext("2d")!;
  cueContext.fillStyle = "#c9f2ea"; cueContext.fillRect(0, 0, 16, 16); cueContext.fillStyle = "#86d3c8"; cueContext.fillRect(2, 2, 12, 12);
  cueContext.fillStyle = "#a9b8c0"; cueContext.fillRect(20, 4, 5, 2); cueContext.fillRect(18, 6, 11, 2); cueContext.fillRect(17, 8, 14, 3); cueContext.fillRect(19, 11, 10, 1);
  cueContext.fillStyle = "#cdd8dd"; cueContext.fillRect(20, 5, 4, 1); cueContext.fillRect(18, 8, 6, 1);
  const cueTexture = new THREE.CanvasTexture(cueCanvas); cueTexture.colorSpace = THREE.SRGBColorSpace;
  cueTexture.magFilter = THREE.NearestFilter; cueTexture.minFilter = THREE.NearestFilter; cueTexture.generateMipmaps = false; textures.push(cueTexture);
  const cueGeometry = new THREE.PlaneGeometry(1, 1), cueRects = new Float32Array(MAX_ANTS * 4);
  cueGeometry.setAttribute("atlasRect", new THREE.InstancedBufferAttribute(cueRects, 4));
  const cueMaterial = new THREE.MeshBasicMaterial({ map: cueTexture, alphaTest: .35, side: THREE.DoubleSide });
  cueMaterial.onBeforeCompile = atlasShader;
  cueMaterial.customProgramCacheKey = () => "world-ant-cue-v1"; materials.push(cueMaterial); geometry.push(cueGeometry);
  const cues = new THREE.InstancedMesh(cueGeometry, cueMaterial, MAX_ANTS); cues.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cues.frustumCulled = false;
  cues.count = 0; cues.visible = false; scene.add(cues);
  // Atlas v2 frames: [x, y, w, h, k, ax]. `frameOf` resolves a pose through the fallback chain once and remembers it.
  const FRAMES = antAtlas.frames as Record<string, number[] | undefined>;
  type AntFrame = { rect: number[]; mirror: boolean; posed: boolean; key: string };
  const frameMemo = new Map<string, AntFrame>();
  const hasFrame = (key: string) => !!FRAMES[key];
  const frameOf = (variant: AntVariant, pose: AntPose, dir8: number, dir4: number, lean: number, bright: boolean): AntFrame => {
    const id = `${variant}.${pose}.${dir8}.${dir4}.${lean}.${bright ? 1 : 0}`;
    let frame = frameMemo.get(id);
    if (!frame) {
      const found = antFrameCandidates(variant, pose, dir8, dir4, lean, bright).find((candidate) => FRAMES[candidate.key]);
      frame = found ? { rect: FRAMES[found.key]!, mirror: found.mirror, posed: found.posed, key: found.key } : { rect: FRAMES["neutral.idle.f"]!, mirror: false, posed: false, key: "neutral.idle.f" };
      frameMemo.set(id, frame);
    }
    return frame;
  };
  // The other scenes pose their ants from the base sheet's grid: five rows, four directions.
  const BASE_ROWS = ["neutral.idle", "neutral.walk-a", "neutral.walk-b", "fear.idle", "hope.idle"], BASE_DIRS = ["f", "l", "r", "b"];
  const crowd = createCrowd();
  // 심리 전장: ants standing in their camps (lib/world-battle-crowd.ts), playing the atlas's emotion loops.
  const battleLoops = emoteFrames(hasFrame), battle = createBattleCrowd({ frames: battleLoops });
  // The other viewers in the battle room walk to the points they chose, like plaza peers (a crowd of peers only: no NPC roams).
  const battlePeers = createCrowd(7);
  /** The crowd that walks the other viewers' ants in the shown scene (none in the theater). */
  const peerCrowd = () => state.scene === "plaza" ? crowd : state.scene === "battle" ? battlePeers : null;
  // NPCs come and go through the back-wall doors, each hiding behind the pier on its outer side; a darkening ant is tinted
  // toward the doorway's dark (darkMat), and a hidden one is drawn at zero size.
  const crowdDoors: CrowdDoor[] = PLAZA_ENTRANCES.map((e) => ({ x: e.x, z: e.z, legs: plazaDoorWay(e, e.x < 0 ? -1 : 1) }));
  const DOOR_DARK = new THREE.Color(0x121b20);
  const dummy = new THREE.Object3D(), color = new THREE.Color(), right = new THREE.Vector3();
  const position: Point = initial.scene === "plaza" ? { x: 0, z: .4 } : { x: 0, z: 3.2 };
  // `cast`: opacity of the non-plaza ants (see RenderState.absent).
  let cast = initial.absent ? 0 : 1;
  let path: Point[] = [], sideList: WorldSide[] = [], roster: CrowdMember[] = [], peers: PlazaPeer[] = [], lastTime = 0, lastRender = 0, disposed = false;
  let width = 0, height = 0, direction = 0, heading8 = 0, visitorLean = 1, visitorStride = 0;
  // The visitor is drawn a little larger than the crowd. Its walk is tied to that drawing: one step (a stride frame and the
  // passing frame after it) covers the distance between the two planted feet of the stride art, so the feet do not slide.
  // VISITOR_FEET is that distance in atlas pixels, measured between the centres of the two ground contacts of the side-view
  // stride frames (neutral walk-a 69 px, walk-b 82 px; the bright set is 71 and 83). On the floor it is .52 at full size.
  // The speed scales with the sprite too, so every pose lasts VISITOR_STEP / 2 / VISITOR_SPEED = 108 ms at any size: two
  // rendered frames at 19 fps, three at 30. A faster ant would need shorter poses, which a slow device skips ("legs do not move").
  const VISITOR_SCALE = 1.12 * 1.45 / 235, VISITOR_FEET = 75.6, VISITOR_STEP = VISITOR_FEET * VISITOR_SCALE, VISITOR_SPEED = 2.4;
  // Sprites are sized for a frame that shows the whole wall. A phone's portrait frame shows a third of that width at the
  // same pixels per unit, so the same ants would fill the screen: below ANT_VIEW world units of visible width they
  // shrink in proportion, down to ANT_SMALL. It follows the eased lens, so zooming in and out resizes smoothly.
  const ANT_VIEW = 11.7, ANT_SMALL = .6;
  const antSize = () => Math.max(ANT_SMALL, Math.min(1, 2 * lens.halfW / ANT_VIEW));
  const CAMERA_DISTANCE = 32, CAMERA_HEIGHT = 8.4, WALL_Y0 = wallScreenY(0, WALL_PANEL_Z);
  // A door's name label stands in front of its plate (far enough that a turned camera never cuts it into the plate), at the
  // height where the resting camera sees it just above the plate's bottom edge.
  const PLATE_Z = WALL_FACE_Z + .24, SIGN_Z = PLATE_Z + .18, CAMERA_Z = WALL_PANEL_Z + CAMERA_DISTANCE;
  const SIGN_Y = CAMERA_HEIGHT + (PLAZA_DOOR.height - PLAZA_DOOR.plate + .025 - CAMERA_HEIGHT) * (CAMERA_Z - SIGN_Z) / (CAMERA_Z - PLATE_Z);
  // While turning, the camera also slides this far (world units per radian) toward the visitor.
  const CAMERA_SLIDE = 8;
  let yaw = 0, orbit = 0, front = 7;
  const corner = new THREE.Vector3();
  let view: WallView = { layout: "wide", section: 1, overview: false, hudBottom: 0 };
  let fit: WallFit = wallFit(1200, 680, { plaza: state.scene === "plaza", ...view });
  // Eased camera frame; `fit` is the target.
  const lens = { cx: fit.cx, top: fit.top, bottom: fit.bottom, halfW: fit.halfW };
  let viewDirty = true, snap = true, rectKey = "";
  // Zoomed section view (portrait phones): the frame follows the visitor, because one section shows only about 5 of the
  // floor's 19 units. (1) The framed section becomes the one the visitor stands in: it changes once the visitor is
  // FOLLOW_KEEP past the border between two sections, so standing on a border does not flap; and (2) the frame pans off
  // the section's centre to keep the visitor within FOLLOW_BAND of the visible half floor from the middle, so the
  // neighbouring section shows well before the visitor reaches the frame edge. Near a section's centre the pan is zero.
  // Choosing a section by hand (arrow buttons, a swipe, focusing a panel) sends the visitor to that section's centre
  // (`visiting`): the frame moves at once and the visitor walks in, with neither (1) nor (2) on the way.
  const FOLLOW_KEEP = .4, FOLLOW_BAND = .3, SECTION_HALF = (WALL_SECTION_X[1] - WALL_SECTION_X[0]) / 2;
  // Zoomed view turn: ZOOM_YAW at ZOOM_REACH units off the aimed centre.
  const ZOOM_YAW = 8 * Math.PI / 180, ZOOM_REACH = 4;
  let asked: WallSection | null = null, visiting: WallSection | null = null;
  const crowdView = (): CrowdView => ({ cx: fit.cx, halfW: fit.halfW, camZ: WALL_PANEL_Z + CAMERA_DISTANCE, dist: CAMERA_DISTANCE, zoomed: zoomed() });
  /** Centre the lens eases toward: the section's (`fit.cx`), moved as little as needed to keep a followed visitor in the frame. */
  const aimCx = () => {
    if (!zoomed() || visiting !== null) return fit.cx;
    // The orbiting camera (see yawTarget: ZOOM_YAW / ZOOM_REACH per unit off the centre) pushes the floor in front of the wall outward.
    const reach = Math.max(0, viewHalf(crowdView(), position.z) * FOLLOW_BAND) / (1 + (position.z - WALL_PANEL_Z) * Math.tan(ZOOM_YAW / ZOOM_REACH));
    return Math.max(position.x - reach, Math.min(position.x + reach, fit.cx));
  };
  function followSection() {
    if (!zoomed() || visiting !== null) return;
    const current = asked ?? view.section;
    if (Math.abs(position.x - WALL_SECTION_X[current]) <= SECTION_HALF + FOLLOW_KEEP) return;
    const next = (position.x < -SECTION_HALF ? 0 : position.x > SECTION_HALF ? 2 : 1) as WallSection;
    if (next !== current) { asked = next; events.section?.(next); }
  }
  const metrics: RenderMetrics = { renders: 0, frames: [], cpu: [], gpu: [], calls: 0, triangles: 0, renderer: "", population: 0, wall: null, atlas: "", puffs: 0, antSize: 1, cast: 1, band: "neutral", bright: false,
    battle: () => state.scene === "battle" ? battle.ants.map((a, i) => ({ ...antMetric(i, a.x, a.z, a.path.length ? "walk" : a.emote ? "emote" : "stand", a.dir8), id: a.id, side: a.side, spot: a.spot, leaving: a.leaving, emote: a.emote?.loop ?? null, fade: a.fade })) : [],
    crowd: () => state.scene === "plaza" ? crowd.ants.map((a, i) => ({ ...antMetric(i, a.x, a.z, a.state, a.dir8), id: a.id, peer: a.peer, leaving: a.exit !== 0 || !!a.trip?.drop, trip: a.trip?.phase ?? null, lap: a.lap, fade: a.fade })) : [],
    visitor: () => antMetric(visitorIndex(), position.x, position.z, path.length ? "walk" : "idle", heading8),
    marker: () => { const m = marker.state; if (!m) return null; const p = project(corner.set(m.x, 0, m.z)); return { ...m, sx: p.x, sy: p.y }; } };
  // Plaza instances are the crowd (including ants walking off) then the visitor, the battle its camp ants (with those walking
  // off), the other viewers' ants, then the visitor; the theater draws sideList then the visitor.
  const visitorIndex = () => state.scene === "plaza" ? Math.min(MAX_ANTS - 1, crowd.ants.length) : state.scene === "battle" ? Math.min(MAX_ANTS - 1, battle.ants.length + battlePeers.ants.length) : sideList.length;
  // What was drawn last for each instance: atlas frame, sprite height in world units, and world units per atlas pixel.
  const shown: string[] = [], talls: number[] = [], units: number[] = [];
  const antMetric = (i: number, x: number, z: number, state: string, dir: number): AntMetric => {
    const tall = talls[i] ?? 0, p = project(corner.set(x, tall / 2, z)), top = project(corner.set(x, tall, z)).y, foot = project(corner.set(x, 0, z)).y;
    return { x, z, state, dir, sx: p.x, sy: p.y, sh: foot - top, frame: shown[i] ?? "", unit: units[i] ?? 0 };
  };
  const gl = renderer.getContext() as WebGL2RenderingContext; const debug = gl.getExtension("WEBGL_debug_renderer_info");
  metrics.atlas = atlasImage;
  metrics.renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "WebGL";
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let queries: WebGLQuery[] = [];
  function summary(): WorldSummary { return state.scene === "battle" ? state.frame.stocks.find((s) => s.symbol === state.stock) ?? state.frame.overall : state.frame.overall; }
  function population() {
    const plaza = state.scene === "plaza", base = crowdCapacity(state.scene, state.mobile);
    // The battle's camps: only the ants that change camp walk; reduced motion places them at once. As on the plaza, every two
    // other viewers take the place of one camp ant.
    if (state.scene === "battle") {
      battle.sync(crowdDistribution(summary(), fakeCapacity(base, peers.length)), { instant: state.reduced });
      roster = peers.map((peer) => ({ id: `peer:${peer.id}`, variant: "neutral" as const, peer: { x: peer.x, z: peer.z } })); sideList = [];
      ants.count = shadows.count = visitorIndex() + 1; metrics.population = battle.ants.filter((a) => !a.leaving).length + peers.length + 1; return;
    }
    // No record to show: the theater keeps the ants it has (they fade out in draw) rather than taking the empty frame's none.
    if (!plaza && state.absent) { roster = []; ants.count = shadows.count = sideList.length + 1; metrics.population = ants.count; return; }
    // On the plaza, every two other viewers take the place of one NPC.
    const counts = crowdDistribution(summary(), plaza ? fakeCapacity(base, peers.length) : base);
    sideList = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
    // NPC ids are per slot: a change in the mood mix changes costumes in place, only a change in headcount walks ants in or out.
    roster = plaza ? [
      ...sideList.map((side, i) => ({ id: `npc:${i}`, variant: SIDE_VARIANT[side] })),
      ...peers.map((peer) => ({ id: `peer:${peer.id}`, variant: "neutral" as const, peer: { x: peer.x, z: peer.z } }))
    ] : [];
    ants.count = shadows.count = sideList.length + (plaza ? peers.length : 0) + 1; metrics.population = ants.count;
  }
  const zoomed = () => state.scene === "plaza" && view.layout === "sectioned" && !view.overview;
  // Gaze follows the visitor. Whole-wall views pan (and slide a little) toward the ant so it sits nearer
  // the middle of the screen; the far end of the wall may leave the frame. The zoomed single-section view
  // has no spare margin, so there the camera orbits the section instead and the panel stays framed.
  const yawTarget = () => {
    // The phone overview exists to show the whole wall: it stays frontal wherever the visitor stands.
    if (state.scene === "plaza" && view.overview) return 0;
    const close = zoomed(), reach = close ? ZOOM_REACH : 10;
    let max = close ? ZOOM_YAW : 10 * Math.PI / 180;
    // Very wide frames turn less so the frame edge stays on the built wall (x within ±33).
    while (!close && max > .01 && CAMERA_SLIDE * max + CAMERA_DISTANCE * Math.tan(max + Math.atan(fit.halfW / CAMERA_DISTANCE)) > 33) max -= .005;
    return Math.max(-1, Math.min(1, (aimCx() - position.x) / reach)) * max || 0;
  };
  /** Deepest floor z the frame shows above the bottom HUD (camera at rest). */
  function visibleFront() {
    const hud = height < WALL_SHORT_STAGE ? 0 : Math.max(0, view.hudBottom);
    const y = (fit.bottom + hud / fit.ppu - WALL_Y0) / WALL_COS; // height on the wall plane at the frame's lower edge
    const depth = y >= 0 ? 0 : -y * CAMERA_DISTANCE / (CAMERA_HEIGHT - y);
    return Math.max(state.scene === "plaza" ? .8 : 4, Math.min(7, WALL_PANEL_Z + depth));
  }
  function applyCamera() {
    // Frame window on the wall plane, as seen from the camera's own height. Vertical is scaled by
    // WALL_COS like the former tilted view, so wallFit / projectPanel still describe the rest pose.
    const near = .5, k = near / CAMERA_DISTANCE;
    camera.projectionMatrix.makePerspective(-lens.halfW * k, lens.halfW * k,
      ((lens.top - WALL_Y0) / WALL_COS - CAMERA_HEIGHT) * k, ((lens.bottom - WALL_Y0) / WALL_COS - CAMERA_HEIGHT) * k, near, 140);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // `orbit` blends the two poses: 1 = orbit the wall pivot, 0 = turn in place and slide toward the visitor.
    camera.position.set(lens.cx + orbit * CAMERA_DISTANCE * Math.sin(yaw) - (1 - orbit) * CAMERA_SLIDE * yaw, CAMERA_HEIGHT,
      WALL_PANEL_Z + CAMERA_DISTANCE * (orbit * Math.cos(yaw) + 1 - orbit));
    camera.rotation.set(0, yaw, 0); camera.updateMatrixWorld();
    const plaza = state.scene === "plaza";
    // Screen bounds of each panel's four corners: exact rectangles at rest, bounding boxes while turned.
    const layout = sceneBoardLayout(state.scene), ids = Object.keys(layout);
    const screenRect = (p: { x: number; y: number; w: number; h: number }, z: number): WallRect => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const q = project(corner.set(p.x + sx * p.w / 2, p.y + sy * p.h / 2, z));
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    };
    const rects = Object.fromEntries(ids.map((id) => [id, screenRect(layout[id], WALL_PANEL_Z)])) as Record<string, WallRect>;
    const doors = plaza ? Object.fromEntries(PLAZA_ENTRANCES.map((e) => [e.scene, screenRect({ x: e.x, y: PLAZA_DOOR.height / 2, w: 2 * PLAZA_DOOR.half, h: PLAZA_DOOR.height }, WALL_FACE_Z)])) : {};
    const aim = aimCx(), settled = lens.cx === aim && lens.halfW === fit.halfW && lens.top === fit.top;
    metrics.wall = plaza ? { rects, drawn: boards.drawn, get shimmer() { return boards.loading(); }, body: metrics.wall?.body ?? 0, ppu: width / (2 * lens.halfW), section: view.section, overview: view.overview, settled, front, yaw, follow: zoomed() && visiting === null, pan: aim - fit.cx, doors } : null;
    const key = ids.map((id) => `${id}:${rects[id].x.toFixed(1)},${rects[id].y.toFixed(1)},${rects[id].width.toFixed(1)}`).join("|");
    if (key !== rectKey) { rectKey = key; events.panels?.(ids.length ? rects : null); }
  }
  function resize() {
    // Detached export canvases have no layout box: use their drawing buffer at 1x.
    const attached = canvas.isConnected;
    const w = (attached && canvas.clientWidth) || canvas.width || 1200, h = (attached && canvas.clientHeight) || canvas.height || 680;
    if (width !== w || height !== h) {
      // A new canvas size is a new frame, not a camera move: never ease across it.
      width = w; height = h; viewDirty = true; snap = true;
      // Wall text needs a real-resolution framebuffer; cap total pixels instead of width.
      const dpr = attached ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      renderer.setPixelRatio(Math.min(dpr, Math.sqrt((state.mobile ? 3.5e6 : 8.3e6) / (w * h)))); renderer.setSize(w, h, false);
    }
    if (!viewDirty) return;
    viewDirty = false;
    fit = wallFit(w, h, { plaza: state.scene === "plaza", ...view });
    front = visibleFront();
    // Keep the visitor on the floor the new frame still shows.
    if (position.z > front - .35) {
      position.z = front - .35; path = [];
      // The clamped row can cut through crates / side buildings: slide inward until the spot is walkable.
      const obstacles = worldObstacles(state.scene);
      while (!walkable(position, obstacles) && Math.abs(position.x) > .1) position.x -= Math.sign(position.x) * .1;
      if (!walkable(position, obstacles)) position.x = 0;
    }
    if (snap) { snap = false; Object.assign(lens, { cx: aimCx(), top: fit.top, bottom: fit.bottom, halfW: fit.halfW }); yaw = yawTarget(); orbit = zoomed() ? 1 : 0; }
    applyCamera();
  }
  function paintWall() {
    // Text is sized for the readable view; the plaza overview only shrinks the same textures.
    const reference = state.scene === "plaza" && view.overview ? wallFit(width, height, { plaza: true, ...view, overview: false }) : fit;
    const body = wallBodyPx(reference.ppu);
    if (metrics.wall) metrics.wall.body = body;
    boards.paint({ ppu: reference.ppu, squeeze: WALL_COS, ratio: renderer.getPixelRatio(), body });
  }
  const project = (point: THREE.Vector3) => { const p = point.project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; };
  /** Motion nobody asked for: crowd roaming and idling, camera eases, the loading sweep. */
  const ambient = () => !state.paused && !state.reduced;
  function draw(time = performance.now()) {
    if (disposed) return;
    resize();
    const dt = Math.min(.05, lastTime ? (time - lastTime) / 1000 : 0); lastTime = time;
    const moving = !state.paused && path.length > 0, walkSize = antSize();
    if (moving) {
      const target = path[0], dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
      direction = Math.abs(dx) > Math.abs(dz) ? dx < 0 ? 1 : 2 : dz < 0 ? 3 : 0;
      heading8 = facing8(dx, dz);
      if (distance > 1e-6) visitorLean = leanOf(dx / distance, visitorLean);
      // Speed and step follow the size the visitor is drawn at (see VISITOR_FEET); the stride is counted in poses.
      const reach = dt * VISITOR_SPEED * walkSize;
      if (distance < reach) { position.x = target.x; position.z = target.z; path.shift(); }
      else { position.x += dx / distance * reach; position.z += dz / distance * reach; }
      visitorStride += Math.min(distance, reach) / (VISITOR_STEP / 2 * walkSize);
    } else visitorStride = 0;
    if (!path.length) visiting = null;
    marker.tick(time, { walking: path.length > 0, reduced: !ambient(), size: walkSize });
    followSection();
    // The lens eases after the visitor has moved, so a followed visitor is framed where it is now.
    const aim = { cx: aimCx(), top: fit.top, bottom: fit.bottom, halfW: fit.halfW };
    if (lens.cx !== aim.cx || lens.halfW !== fit.halfW || lens.top !== fit.top || lens.bottom !== fit.bottom) {
      // Section pan / overview zoom: ~300 ms ease, immediate when paused.
      const k = ambient() ? 1 - Math.exp(-dt * 10) : 1;
      for (const key of ["cx", "top", "bottom", "halfW"] as const) {
        lens[key] += (aim[key] - lens[key]) * k;
        if (Math.abs(aim[key] - lens[key]) < 1e-3) lens[key] = aim[key];
      }
      applyCamera();
    }
    if (metrics.wall) metrics.wall.follow = zoomed() && visiting === null;
    paintWall();
    if (ambient()) boards.tick(time / 1000);
    const turn = yawTarget(), mode = zoomed() ? 1 : 0;
    if (yaw !== turn || orbit !== mode) {
      yaw += (turn - yaw) * (ambient() ? 1 - Math.exp(-dt * 3) : 1);
      orbit += (mode - orbit) * (ambient() ? 1 - Math.exp(-dt * 10) : 1);
      if (Math.abs(turn - yaw) < 1e-4) yaw = turn;
      if (Math.abs(mode - orbit) < 1e-3) orbit = mode;
      applyCamera();
    }
    const sum = summary();
    amber.intensity = sum.total < 3 ? 32 : 30 + (sum.hope_ratio ?? 0) * 34;
    warning.intensity = sum.total < 3 ? 12 : 12 + (sum.fear_ratio ?? 0) * 35;
    const obstacles = worldObstacles(state.scene), plaza = state.scene === "plaza";
    cast = metrics.cast = plaza ? 1 : castFade(cast, !!state.absent, dt, ambient());
    // When the 곡소리 지수 reads 희망 the plaza faces brighten. The band is the one the wall's index panel and portrait
    // show (the same scope), read every draw: a data refresh that moves the index changes the faces in place.
    const shownBand = metrics.band = band ?? stockPierrotArt(sum).band;
    const hopeful = metrics.bright = plaza && (shownBand === "bullish" || shownBand === "extreme_bullish");
    if (plaza) {
      // The crowd follows the framed section (`fit`), not the easing lens or the pan that follows the visitor: a moving
      // centre would read as a section change on every frame.
      // In the zoomed section view the section arrows sit on the front of the floor: keep the crowd clear of them.
      const env = { obstacles, front: zoomed() ? Math.max(.8, front - 1.2) : front, visitor: position, restless: sum.mood === "mixed", hopeful,
        view: crowdView(), doors: crowdDoors };
      crowd.sync(roster, env);
      if (ambient()) crowd.step(dt, env);
      ants.count = shadows.count = visitorIndex() + 1;
    } else if (state.scene === "battle") {
      // The camps keep to the floor the frame shows (a portrait phone frames only the middle of the field).
      battle.frame(crowdView(), { instant: state.reduced });
      if (!state.paused) battle.step(dt, { still: state.reduced });
      const env = { obstacles, front, visitor: position, view: crowdView() };
      battlePeers.sync(roster, env);
      if (ambient()) battlePeers.step(dt, env);
      ants.count = shadows.count = visitorIndex() + 1;
    }
    let cueCount = 0, puffs = 0;
    const size = metrics.antSize = antSize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const cue = (puff: boolean, x: number, y: number, z: number, w: number, h: number) => {
      const n = cueCount++; if (puff) puffs++;
      cueRects[n * 4] = puff ? .5 : 0; cueRects[n * 4 + 1] = 0; cueRects[n * 4 + 2] = .5; cueRects[n * 4 + 3] = 1;
      dummy.position.set(x, y, z + .05); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(w, h / WALL_COS, 1); dummy.updateMatrix(); cues.setMatrixAt(n, dummy.matrix);
    };
    const hide = (i: number) => { shown[i] = ""; talls[i] = 0; dummy.scale.set(0, 0, 0); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix); shadows.setMatrixAt(i, dummy.matrix); };
    /** Draws an atlas frame (k-scaled, mirrored as resolved) standing on (x, z), `stretch` times its height; returns that height. */
    const placeSprite = (i: number, frame: AntFrame, x: number, z: number, scale: number, bob: number, stretch = 1) => {
      const rect = frame.rect;
      offsets[i * 4] = (frame.mirror ? rect[0] + rect[2] : rect[0]) / antAtlas.width; offsets[i * 4 + 1] = 1 - (rect[1] + rect[3]) / antAtlas.height;
      offsets[i * 4 + 2] = (frame.mirror ? -rect[2] : rect[2]) / antAtlas.width; offsets[i * 4 + 3] = rect[3] / antAtlas.height;
      // The frame squeezes heights by WALL_COS; sprites are stretched back so they keep their proportions.
      const tall = rect[3] * scale / WALL_COS * stretch;
      shown[i] = frame.mirror ? `${frame.key}~` : frame.key; talls[i] = tall; units[i] = scale;
      // Each frame's body anchor (ax) stands on the ant's floor point, so poses of different widths do not shake sideways.
      const slide = (rect[2] / 2 - (rect[5] ?? rect[2] / 2)) * scale * (frame.mirror ? -1 : 1);
      dummy.position.set(x + right.x * slide, bob + tall / 2, z + right.z * slide); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(rect[2] * scale, tall, 1); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix);
      return tall;
    };
    const placeShadow = (i: number, x: number, z: number, k: number) => { dummy.position.set(x, .025, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(size * k, .55 * size * k, 1); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix); };
    const you = visitorIndex(), heads: Record<string, { x: number; y: number }> = {}, peerTags: LabelSpec[] = [];
    // In the battle the peers' instances follow the camp ants'.
    const walkers = peerCrowd(), firstPeer = state.scene === "battle" ? battle.ants.length : 0;
    for (let i = 0; i < ants.count; i++) {
      const visitor = i === you, side = sideList[i];
      if (state.scene === "battle" && !visitor && i < firstPeer) {
        // A camp ant: standing at its spot (hope smiling), walking to a new camp, or playing an emotion loop. Without ambient
        // motion it stands still in its plain pose.
        const b = battle.ants[i], variant = SIDE_VARIANT[b.side], walking = b.path.length > 0, still = !ambient();
        fades[i] = b.fade;
        if (b.fade <= 0) { hide(i); continue; }
        let pose = battlePose(still ? { ...b, emote: null } : b, battleLoops, WALK_PHASE * size), dir8 = b.dir8, bright = b.side === "bullish";
        if (walking) ({ pose, dir8, bright } = antWalkFrame(hasFrame, variant, pose, dir8, b.dir4, bright));
        const bob = (walking ? walkLift(b.stride, WALK_PHASE * size) * .04 : !b.emote && !still ? Math.sin(time / 2400 + b.build * 53) * .025 : 0) * size;
        const frame = frameOf(variant, pose, dir8, b.dir4, b.lean, bright), k = frame.rect[4] ?? 1;
        placeSprite(i, frame, b.x, b.z, b.build * 1.45 / 235 * k * size, bob);
        ants.setColorAt(i, color.set("#ffffff"));
        placeShadow(i, b.x, b.z, b.fade);
        continue;
      }
      if (!walkers && !visitor) {
        let x = -6.6 + (i * 73 % 130) / 10, z = -1.7 + (i * 37 % 75) / 10;
        if (!walkable({ x, z }, obstacles)) z = 3.2 + i % 3 * .15;
        fades[i] = cast;
        if (cast <= 0) { hide(i); continue; }
        const shift = !ambient() ? 0 : Math.sin(time / 2400 + i * 1.7) * .025;
        let row = side === "bearish" ? 3 : side === "bullish" ? 4 : 0, column = i % 4;
        // Mixed sentiment: short steps, pauses, and turns in opposite directions.
        // Phase offsets keep the crowd from moving in unison. Counts and evidence stay unchanged.
        if (ambient() && sum.mood === "mixed" && side !== "neutral") {
          const phase = (time / 900 + i * .73) % 4;
          const goingRight = phase < 2;
          const stepping = phase < 1 || (phase >= 2 && phase < 3);
          const progress = stepping ? phase % 1 : 1;
          const offset = goingRight ? -.28 + .56 * progress : .28 - .56 * progress;
          if (walkable({ x: x + offset, z }, obstacles)) x += offset;
          column = goingRight ? 2 : 1;
          // Stride, feet together, other stride, feet together: the two side-view strides alone look like frozen legs.
          row = stepping ? [1, 0, 2, 0][Math.floor(time / 200 + i) % 4] : 0;
        }
        const rect = FRAMES[`${BASE_ROWS[row]}.${BASE_DIRS[column]}`]!;
        offsets[i * 4] = rect[0] / antAtlas.width; offsets[i * 4 + 1] = 1 - (rect[1] + rect[3]) / antAtlas.height;
        offsets[i * 4 + 2] = rect[2] / antAtlas.width; offsets[i * 4 + 3] = rect[3] / antAtlas.height;
        const scale = (.9 + i % 3 * .06) * 1.45 / 235 * size;
        // The frame squeezes heights by WALL_COS; sprites are stretched back so they keep their proportions.
        const tall = rect[3] * scale / WALL_COS;
        shown[i] = ""; talls[i] = tall; units[i] = scale;
        dummy.position.set(x, shift * size + tall / 2, z); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(rect[2] * scale, tall, 1); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix);
        ants.setColorAt(i, color.set("#ffffff"));
        placeShadow(i, x, z, cast);
        continue;
      }
      fades[i] = 1;
      // The visitor (in every scene) keeps its own walk; plaza NPCs follow the crowd simulation (roam, gaze at the wall, phone,
      // sigh), and other viewers' ants (plaza and battle) walk where those viewers chose.
      const a = visitor ? null : walkers?.ants[i - firstPeer] ?? null, fade = a ? a.fade : 1;
      if (!visitor && !a) { hide(i); continue; }
      if (fade <= 0) { hide(i); continue; } // away on a trip: nothing drawn, no tag, no cue
      const x = a ? a.x : position.x, z = a ? a.z : position.z;
      const dir4 = a ? a.dir4 : [0, 2, 6, 4][direction];
      const variant: AntVariant = a ? a.variant : "neutral";
      // The walk cycle advances with the floor covered, in steps that match the drawn size of the legs.
      // An ant that has just set off has not moved yet: it already shows the step its stride count is at, not a stray first frame.
      const walking = a ? a.state === "walk" && (a.moved || a.pose !== "idle") : moving, stride = a ? a.stride : visitorStride, phase = a ? WALK_PHASE * size : 1;
      let dir8 = a ? a.dir8 : heading8, pose: AntPose = walking ? walkPose(stride, phase) : a ? antGazePose(hasFrame, variant, a, hopeful) : "idle";
      let bright = hopeful;
      if (walking || (a && a.state === "walk")) ({ pose, dir8, bright } = antWalkFrame(hasFrame, variant, pose, dir8, dir4, hopeful));
      // Camera-facing art is a three-quarter view: `lean` turns it to the side the ant is heading (mirrored where needed).
      const lean = a ? a.lean : visitorLean;
      const frame = frameOf(variant, pose, dir8, dir4, lean, bright);
      const rect = frame.rect, k = rect[4] ?? 1;
      const scale = (visitor ? VISITOR_SCALE : (.9 + i % 3 * .06) * 1.45 / 235) * k * size;
      // Standing ants breathe; a sigh sinks and recovers over its span (t counts down from span).
      // Walkers rise as the feet pass and sink into each stride.
      const bob = (a && a.state === "gaze" && ambient() ? Math.sin(time / 2400 + i * 1.7) * .025 : walking ? walkLift(stride, phase) * .04 : 0) * size;
      // Under a hopeful index the sigh state is drawn as the relieved pose (the bright "sigh" art): no sinking, no breath.
      const sighing = a && a.state === "sigh" && a.span > 0 && !frame.key.includes("-bright.sigh.") ? 1 - a.t / a.span : -1;
      const tall = placeSprite(i, frame, x, z, scale, bob, sighing >= 0 ? 1 - .06 * Math.sin(Math.PI * sighing) : 1);
      ants.setColorAt(i, visitor ? color.set(state.color) : color.set("#ffffff").lerp(DOOR_DARK, 1 - fade));
      if (a?.peer && !a.exit && fade >= 1) {
        const name = peers.find((peer) => `peer:${peer.id}` === a.id)?.name;
        const top = tall * 1.04 + bob;
        if (name) peerTags.push({ id: a.id, text: name, style: "peer", at: { x, y: top, z } });
        const head = project(corner.set(x, top, z)); heads[a.id.slice(5)] = { x: head.x, y: head.y };
      }
      placeShadow(i, x, z, fade);
      if (a && fade >= 1 && cueCount < MAX_ANTS) {
        const high = rect[3] * scale / WALL_COS;
        if (a.state === "phone" && !frame.posed && dir4 !== 4) {
          const off = (dir4 === 0 ? .12 * lean : dir4 === 2 ? -.2 : .2) * size;
          cue(false, x + right.x * off, high * .62, z + right.z * off, .16 * size, .22 * size);
        } else if (sighing >= .15 && sighing <= .85) {
          // The breath leaves the mouth (beside the hidden face in the back view), drifts outward and rises.
          const off = (dir4 === 0 ? .3 * lean : dir4 === 2 ? -.36 : dir4 === 6 ? .36 : .3) * (1 + sighing * .25) * size, puff = .3 * (.6 + sighing) * size;
          cue(true, x + right.x * off, high * (dir4 === 4 ? .66 : dir4 === 0 ? .5 : .56) + sighing * .4 * size, z + right.z * off, puff, puff);
        }
      }
    }
    cues.count = cueCount; cues.visible = cueCount > 0; metrics.puffs = puffs;
    if (cueCount) { cues.instanceMatrix.needsUpdate = true; (cueGeometry.getAttribute("atlasRect") as THREE.InstancedBufferAttribute).needsUpdate = true; }
    ants.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = true; if (ants.instanceColor) ants.instanceColor.needsUpdate = true;
    (antGeometry.getAttribute("atlasRect") as THREE.InstancedBufferAttribute).needsUpdate = true;
    (antGeometry.getAttribute("antFade") as THREE.InstancedBufferAttribute).needsUpdate = true;
    // The name tag sits just above the visitor's head. Each door carries its name plate; at a door the visitor stands in front of
    // that plate (a low door is about head high on screen), so the prompt lies on the floor just past its feet instead.
    const head = (talls[you] ?? 1.73) * 1.04, near = entranceAt(state.scene, position)?.scene;
    const tags: LabelSpec[] = [...peerTags, ...visitorTag === null ? [] : [{ id: "visitor", text: visitorTag, style: "name" as const, at: { x: position.x, y: head, z: position.z } }]];
    if (plaza) for (const e of PLAZA_ENTRANCES) {
      tags.push({ id: `door-${e.scene}`, text: e.name, style: "sign", at: { x: e.x, y: SIGN_Y, z: SIGN_Z } });
      if (near === e.scene) tags.push({ id: `entrance-${e.scene}`, text: `${e.name} 입구 · 들어가기 ↗`, style: "prompt", at: { x: e.x, y: .05, z: position.z + 1.4 } });
    }
    labels.set(tags);
    const tagRects = labels.measure(camera, width, height), tagKey = Object.entries(tagRects).map(([id, r]) => `${id}:${r.x.toFixed(0)},${r.y.toFixed(0)},${r.width.toFixed(0)}`).join("|");
    if (tagKey !== labelKey) { labelKey = tagKey; events.labels?.(tagRects); }
    const p = project(corner.set(position.x, head, position.z)); events.avatar?.(p.x, p.y, position);
    if (walkers) events.peers?.(heads);
    const query = timer && queries.length < 6 ? gl.createQuery() : null;
    if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    const start = performance.now(); renderer.render(scene, camera); const duration = performance.now() - start;
    if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query); }
    while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = queries.shift()!; if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) metrics.gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
    }
    metrics.cpu.push(duration); if (lastRender) metrics.frames.push(time - lastRender); lastRender = time;
    metrics.renders++; metrics.calls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    for (const values of [metrics.cpu, metrics.frames, metrics.gpu]) if (values.length > 600) values.splice(0, values.length - 600);
  }
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_FACE_Z);
  function click(x: number, y: number) {
    // Every click is a floor click (ants are not targets, so one that lands on an ant walks to the floor behind it), except on a
    // plaza doorway: a click on the door, or on the strip of floor and steps in front of it, walks to it, and one there goes in.
    raycaster.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
    const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    visiting = null;
    if (state.scene === "plaza") {
      const hit = !target || target.z < WALL_FACE_Z ? raycaster.ray.intersectPlane(wallPlane, new THREE.Vector3()) : target;
      const door = hit && hit.z < WORLD_BOUNDS.back + .3 && hit.y <= PLAZA_DOOR.height + PLAZA_DOOR.lintel ? PLAZA_ENTRANCES.find((e) => Math.abs(hit.x - e.x) < PLAZA_DOOR.half + .4) : undefined;
      if (door) {
        if (entranceAt(state.scene, position)?.scene === door.scene) events.enter?.(door.scene); else walkTo({ x: door.x, z: door.z }, true);
        return;
      }
    }
    if (target) walkTo({ x: target.x, z: limitZ(target.z) }, true);
  }
  /** `clicked`: a floor or door click asked for this walk, so its end gets the ground marker; any other walk clears it. */
  function walkTo(target: Point, clicked = false) {
    if (Math.hypot(target.x - position.x, target.z - position.z) < 1e-3) return; // Already there after clamping.
    path = findWorldPath(position, target, worldObstacles(state.scene));
    const end = path[path.length - 1];
    if (clicked && end) marker.show(end); else marker.hide();
    if (end) { events.step?.(); events.walk?.(end); }
  }
  // The floor is only walkable where the framed view shows it.
  const limitZ = (z: number) => Math.min(z, front - .35);
  /** Walk the visitor to the centre of a wall section, clear of the plaza entrances so no prompt pops up on the way in. */
  function visit(section: WallSection) {
    visiting = section;
    const target = { x: WALL_SECTION_X[section], z: limitZ(position.z) }, door = entranceAt(state.scene, target);
    if (door) target.z = limitZ(door.z + 1.5);
    if (!walkable(target, worldObstacles(state.scene))) { visiting = null; return; }
    walkTo(target);
    if (!path.length) visiting = null;
  }
  function update(next: RenderState) {
    const changed = state.scene !== next.scene, density = state.mobile !== next.mobile; state = next;
    if (changed) {
      path = []; snap = true; visiting = null; marker.hide();
      // A new room starts with its own ants: none yet where the theater has no record to show (they fade in with one).
      cast = state.absent ? 0 : 1; if (state.absent) sideList = [];
      battle.reset(); // the camps are placed as they stand, not walked in
      if (state.scene === "plaza") { position.x = 0; position.z = .4; }
      else if (!walkable(position, worldObstacles(state.scene))) { position.x = 0; position.z = 3.2; }
      buildRoom();
    }
    if (state.paused) { lastTime = lastRender = 0; }
    population();
    // Re-fit without treating a props change as a new frame (that would cancel the camera eases);
    // only the pixel budget needs the full resize path.
    viewDirty = true; if (density) width = 0;
  }
  const lost = (event: Event) => { event.preventDefault(); events.failure?.(); }; canvas.addEventListener("webglcontextlost", lost);
  buildRoom(); population();
  return {
    update, draw, click, metrics, position,
    setView(next) {
      if (next.layout !== view.layout) snap = true;
      // A section this renderer did not ask for was chosen by hand: the visitor walks to its centre.
      const picked = next.section !== view.section && next.section !== asked;
      if (picked || next.section === asked) asked = null;
      view = next; viewDirty = true;
      if (picked && zoomed()) visit(next.section);
    },
    setBoards(specs) { boards.set(specs); },
    setBand(next) { band = next; },
    setVisitorTag(text) { visitorTag = text === null ? null : text || "나"; },
    setPeers(next) { peers = next; population(); },
    say(id, seconds) { peerCrowd()?.say(`peer:${id}`, seconds); },
    setFont(family) { labels.setFont(family); },
    wallTexture: (id) => boards.canvas(id),
    move(x, z) { visiting = null; const target = { x: position.x + x, z: limitZ(position.z + z) }; if (walkable(target, worldObstacles(state.scene))) walkTo(target); },
    async capture(frame) {
      const target = document.createElement("canvas"); target.width = 1200; target.height = 620; target.style.width = "1200px"; target.style.height = "620px";
      // Export uses the exact scene builder, atlas, lighting and population mapping.
      const exported = await createWorldRenderer(target, { ...state, frame, scene: "theater", mobile: false, paused: true, absent: false });
      try { exported.draw(0); const copy = document.createElement("canvas"); copy.width = target.width; copy.height = target.height; copy.getContext("2d")!.drawImage(target, 0, 0); return copy; }
      finally { exported.dispose(); }
    },
    dispose() {
      disposed = true; canvas.removeEventListener("webglcontextlost", lost); boards.dispose(); labels.dispose(); marker.dispose();
      scene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); geometry.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); queries.forEach((q) => gl.deleteQuery(q)); queries = [];
      renderer.dispose();
    }
  };
}
