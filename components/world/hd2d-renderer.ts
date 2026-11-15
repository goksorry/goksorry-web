import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldFrame, WorldScene, WorldSide, WorldSummary } from "@/lib/world";
import { crowdCapacity, crowdDistribution } from "@/lib/world-presentation";
import { antFrameCandidates, antWalkFrame, createCrowd, facing4, facing8, leanOf, type AntPose, type AntVariant } from "@/lib/world-crowd";
import { findWorldPath, walkable, worldObstacles, type Point } from "@/lib/world-navigation";
import { WALL_COS, WALL_PANELS, WALL_PANEL_IDS, WALL_PANEL_Z, WALL_SHORT_STAGE, wallBodyPx, wallFit, wallScreenY, type WallFit, type WallModel, type WallPanelId, type WallRect, type WallTextPanelId, type WallView } from "@/lib/world-wall";
import { paintWallPanel, type WallPaintStyle } from "./wall-painter";
import antAtlas from "./ant-atlas.json";

export type RenderState = { frame: WorldFrame; scene: WorldScene; stock: string; mobile: boolean; color: string; paused: boolean };
export type WallMetrics = { rects: Record<WallPanelId, WallRect>; drawn: Partial<Record<WallPanelId, string>>; body: number; ppu: number; section: number; overview: boolean; settled: boolean; front: number; yaw: number };
export type RenderMetrics = { renders: number; frames: number[]; cpu: number[]; gpu: number[]; calls: number; triangles: number; renderer: string; population: number; wall: WallMetrics | null;
  /** Plaza NPC ants (empty elsewhere): floor position, state, 8-way facing (ANT_DIRS index) and screen point of the body. */
  crowd: () => { x: number; z: number; state: string; dir: number; sx: number; sy: number }[];
  visitor: () => Point };
export type WorldRenderer = {
  update: (state: RenderState) => void;
  setView: (view: WallView) => void;
  setWall: (model: WallModel | null, style?: WallPaintStyle) => void;
  wallTexture: (id: WallTextPanelId) => HTMLCanvasElement;
  move: (x: number, z: number) => void;
  click: (x: number, y: number) => void;
  draw: (time?: number) => void;
  capture: (frame: WorldFrame) => Promise<HTMLCanvasElement>;
  dispose: () => void;
  metrics: RenderMetrics;
  position: Point;
};
const TEXT_PANELS: WallTextPanelId[] = ["market", "room", "index", "feed"];

export async function createWorldRenderer(canvas: HTMLCanvasElement, initial: RenderState, events: {
  panels?: (rects: Record<WallPanelId, WallRect> | null) => void;
  avatar?: (x: number, y: number, position: Point) => void;
  evidence?: (side: WorldSide) => void;
  step?: () => void;
  failure?: () => void;
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
  let source: THREE.Texture, atlas: THREE.Texture;
  try { [source, atlas] = await Promise.all((["/world/materials.png", antAtlas.image]).map((url) => loader.loadAsync(url).then((t) => { textures.push(t); return t; }))); }
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
  const cable = (points: THREE.Vector3[]) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .035, 4, false), darkMat, 0, 0, 0);
  function buildRoom() {
    room.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); staticRoot.remove(room); room = new THREE.Group(); staticRoot.add(room);
    // Frontal stage: one flat 9-high back wall carries the information panels.
    // Floor and brick repeat past the side walls so wide viewports never show void.
    // The follow camera pans sideways and swings the frame's lower corners forward, so the wall runs
    // as wide as the floor and a front strip continues the floor toward the camera.
    for (const x of [-23, 0, 23]) { box(x, -.38, 0, 23, .75, 17, floorMat); box(x, -.38, 10.5, 23, .75, 4, floorMat); }
    for (const x of [-28, -16.8, -5.6, 5.6, 16.8, 28]) box(x, 4.5, -5.3, 11.2, 9, .65, brickMat);
    box(0, 9.12, -5.2, 68, .24, 1.1, metalMat);
    box(0, .4, -4.2, 21.2, .8, 1.5, plasterMat);
    for (let j = 0; j < 3; j++) box(0, .1 + j * .12, -3.3 - j * .32, 19.8, .2, .45, brickMat);
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
    if (state.scene === "plaza") {
      // Frames are lit scenery; the panel faces themselves are separate unlit meshes.
      for (const id of WALL_PANEL_IDS) {
        const p = WALL_PANELS[id], portrait = id === "pierrot";
        box(p.x, p.y, -4.94, p.w + (portrait ? .5 : .24), p.h + (portrait ? .5 : .24), .1, portrait ? goldMat : metalMat);
      }
    } else {
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
    if (state.scene === "ecosystem") {
      for (let i = 0; i < 6; i++) { const x = -6.8 + i * 2.7; box(x, 1.1, -3.6, 2.35, 2.2, 1.1, brickMat); arch(x, -2.99, 1.25, 1.8); }
    } else if (state.scene === "battle") {
      for (let i = 0; i < 4; i++) { const p = box(0, .7, -.9 + i * .7, .65, 1.25, .5, woodMat); p.rotation.z = (i % 2 ? 1 : -1) * .15; }
      for (const sign of [-1, 1]) { box(sign * 5.5, 1.8, -.5, .08, 3.6, .08, metalMat); box(sign * 5.1, 3.2, -.5, .8, .6, .04, sign < 0 ? glowMat : redMat); }
    } else if (state.scene === "broadcast") {
      box(0, .3, -1, 6.5, .6, 3.5, woodMat);
      for (const sign of [-1, 1]) { box(sign * 3.5, 1.7, -2, 1, 2.8, .9, metalMat); for (let i = 0; i < 5; i++) box(sign * 3.5, .8 + i * .45, -1.5, .7, .12, .04, darkMat); }
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
  // Wall panels: unlit textured planes on the back wall, never merged with the room.
  const wallGroup = new THREE.Group(); wallGroup.visible = false; scene.add(wallGroup);
  const panelGeometry = new THREE.PlaneGeometry(1, 1); geometry.push(panelGeometry);
  const panelMesh = (id: WallPanelId, map: THREE.Texture | null) => {
    const m = new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : 0x101c22, toneMapped: false, fog: false }); materials.push(m);
    const p = WALL_PANELS[id], o = new THREE.Mesh(panelGeometry, m);
    o.position.set(p.x, p.y, WALL_PANEL_Z); o.scale.set(p.w, p.h, 1); o.userData.panel = id; wallGroup.add(o); return o;
  };
  const wallCanvases = {} as Record<WallTextPanelId, HTMLCanvasElement>, wallTextures = {} as Record<WallTextPanelId, THREE.CanvasTexture>;
  for (const id of TEXT_PANELS) {
    const c = document.createElement("canvas"); c.width = c.height = 4;
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture); wallCanvases[id] = c; wallTextures[id] = texture; panelMesh(id, texture);
  }
  const pierrotMesh = panelMesh("pierrot", null), pierrotMaterial = pierrotMesh.material as THREE.MeshBasicMaterial;
  const pierrotCache = new Map<string, THREE.Texture>();
  let wallModel: WallModel | null = null, wallStyle: WallPaintStyle = { family: "sans-serif", up: "#e0705f", down: "#6fa3e0" };
  let wallDirty = true, pierrotSrc = "";
  const drawn: Partial<Record<WallPanelId, string>> = {};
  const antGeometry = new THREE.PlaneGeometry(1, 1);
  const offsets = new Float32Array(48 * 4);
  antGeometry.setAttribute("atlasRect", new THREE.InstancedBufferAttribute(offsets, 4));
  const antMaterial = new THREE.MeshBasicMaterial({ map: atlas, alphaTest: .35, side: THREE.DoubleSide });
  antMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 atlasRect;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = uv * atlasRect.zw + atlasRect.xy;");
  };
  antMaterial.customProgramCacheKey = () => "world-ant-atlas-v1"; materials.push(antMaterial); geometry.push(antGeometry);
  const ants = new THREE.InstancedMesh(antGeometry, antMaterial, 48); ants.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ants.frustumCulled = false; scene.add(ants);
  const shadowGeometry = new THREE.CircleGeometry(.46, 12); geometry.push(shadowGeometry);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x04090d, transparent: true, opacity: .36, depthWrite: false }); materials.push(shadowMaterial);
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, 48); shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shadows.frustumCulled = false; scene.add(shadows);
  // Plaza cues: a phone screen (only when the phone pose had to fall back to a frame without a phone) and the breath of a sigh.
  const cueCanvas = document.createElement("canvas"); cueCanvas.width = 32; cueCanvas.height = 16;
  const cueContext = cueCanvas.getContext("2d")!;
  cueContext.fillStyle = "#c9f2ea"; cueContext.fillRect(0, 0, 16, 16); cueContext.fillStyle = "#86d3c8"; cueContext.fillRect(2, 2, 12, 12);
  cueContext.fillStyle = "#a9b8c0"; cueContext.fillRect(20, 4, 5, 2); cueContext.fillRect(18, 6, 11, 2); cueContext.fillRect(17, 8, 14, 3); cueContext.fillRect(19, 11, 10, 1);
  cueContext.fillStyle = "#cdd8dd"; cueContext.fillRect(20, 5, 4, 1); cueContext.fillRect(18, 8, 6, 1);
  const cueTexture = new THREE.CanvasTexture(cueCanvas); cueTexture.colorSpace = THREE.SRGBColorSpace;
  cueTexture.magFilter = THREE.NearestFilter; cueTexture.minFilter = THREE.NearestFilter; cueTexture.generateMipmaps = false; textures.push(cueTexture);
  const cueGeometry = new THREE.PlaneGeometry(1, 1), cueRects = new Float32Array(48 * 4);
  cueGeometry.setAttribute("atlasRect", new THREE.InstancedBufferAttribute(cueRects, 4));
  const cueMaterial = new THREE.MeshBasicMaterial({ map: cueTexture, alphaTest: .35, side: THREE.DoubleSide });
  cueMaterial.onBeforeCompile = antMaterial.onBeforeCompile;
  cueMaterial.customProgramCacheKey = () => "world-ant-cue-v1"; materials.push(cueMaterial); geometry.push(cueGeometry);
  const cues = new THREE.InstancedMesh(cueGeometry, cueMaterial, 48); cues.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cues.frustumCulled = false;
  cues.count = 0; cues.visible = false; cues.raycast = () => {}; scene.add(cues);
  // Atlas v2 frames: [x, y, w, h, k, ax]. `frameOf` resolves a pose through the fallback chain once and remembers it.
  const FRAMES = antAtlas.frames as Record<string, number[] | undefined>;
  type AntFrame = { rect: number[]; mirror: boolean; posed: boolean };
  const frameMemo = new Map<string, AntFrame>();
  const hasFrame = (key: string) => !!FRAMES[key];
  const frameOf = (variant: AntVariant, pose: AntPose, dir8: number, dir4: number, lean: number): AntFrame => {
    const id = `${variant}.${pose}.${dir8}.${dir4}.${lean}`;
    let frame = frameMemo.get(id);
    if (!frame) {
      const found = antFrameCandidates(variant, pose, dir8, dir4, lean).find((candidate) => FRAMES[candidate.key]);
      frame = found ? { rect: FRAMES[found.key]!, mirror: found.mirror, posed: found.posed } : { rect: [...antAtlas.cells[0][0], 1, antAtlas.cells[0][0][2] / 2], mirror: false, posed: false };
      frameMemo.set(id, frame);
    }
    return frame;
  };
  const crowd = createCrowd();
  const dummy = new THREE.Object3D(), color = new THREE.Color(), right = new THREE.Vector3();
  const position: Point = initial.scene === "plaza" ? { x: 0, z: .4 } : { x: 0, z: 3.2 };
  let path: Point[] = [], sideList: WorldSide[] = [], lastTime = 0, lastRender = 0, disposed = false;
  let width = 0, height = 0, direction = 0, heading8 = 0, visitorLean = 1;
  const CAMERA_DISTANCE = 32, CAMERA_HEIGHT = 8.4, WALL_Y0 = wallScreenY(0, WALL_PANEL_Z);
  // While turning, the camera also slides this far (world units per radian) toward the visitor.
  const CAMERA_SLIDE = 8;
  let yaw = 0, orbit = 0, front = 7;
  const corner = new THREE.Vector3();
  let view: WallView = { layout: "wide", section: 1, overview: false, hudBottom: 0 };
  let fit: WallFit = wallFit(1200, 680, { plaza: state.scene === "plaza", ...view });
  // Eased camera frame; `fit` is the target.
  const lens = { cx: fit.cx, top: fit.top, bottom: fit.bottom, halfW: fit.halfW };
  let viewDirty = true, snap = true, rectKey = "";
  const metrics: RenderMetrics = { renders: 0, frames: [], cpu: [], gpu: [], calls: 0, triangles: 0, renderer: "", population: 0, wall: null,
    crowd: () => state.scene === "plaza" ? crowd.ants.slice(0, sideList.length).map((a) => {
      const p = project(corner.set(a.x, .8, a.z));
      return { x: a.x, z: a.z, state: a.state, dir: facing8(a.hx, a.hz), sx: p.x, sy: p.y };
    }) : [],
    visitor: () => ({ ...position }) };
  const gl = renderer.getContext() as WebGL2RenderingContext; const debug = gl.getExtension("WEBGL_debug_renderer_info");
  metrics.renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "WebGL";
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let queries: WebGLQuery[] = [];
  function summary(): WorldSummary { return state.scene === "battle" || state.scene === "ecosystem" ? state.frame.stocks.find((s) => s.symbol === state.stock) ?? state.frame.overall : state.frame.overall; }
  function population() {
    const counts = crowdDistribution(summary(), crowdCapacity(state.scene, state.mobile));
    sideList = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
    ants.count = shadows.count = sideList.length + 1; metrics.population = ants.count;
  }
  const zoomed = () => state.scene === "plaza" && view.layout === "sectioned" && !view.overview;
  // Gaze follows the visitor. Whole-wall views pan (and slide a little) toward the ant so it sits nearer
  // the middle of the screen; the far end of the wall may leave the frame. The zoomed single-section view
  // has no spare margin, so there the camera orbits the section instead and the panel stays framed.
  const yawTarget = () => {
    const close = zoomed(), reach = close ? 4 : 10;
    let max = (close ? 4 : 10) * Math.PI / 180;
    // Very wide frames turn less so the frame edge stays on the built wall (x within ±33).
    while (!close && max > .01 && CAMERA_SLIDE * max + CAMERA_DISTANCE * Math.tan(max + Math.atan(fit.halfW / CAMERA_DISTANCE)) > 33) max -= .005;
    return Math.max(-1, Math.min(1, (fit.cx - position.x) / reach)) * max || 0;
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
    const rects = Object.fromEntries(WALL_PANEL_IDS.map((id) => {
      const p = WALL_PANELS[id]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const q = project(corner.set(p.x + sx * p.w / 2, p.y + sy * p.h / 2, WALL_PANEL_Z));
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
      return [id, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }];
    })) as Record<WallPanelId, WallRect>;
    const settled = lens.cx === fit.cx && lens.halfW === fit.halfW && lens.top === fit.top;
    metrics.wall = plaza ? { rects, drawn, body: metrics.wall?.body ?? 0, ppu: width / (2 * lens.halfW), section: view.section, overview: view.overview, settled, front, yaw } : null;
    const key = plaza ? WALL_PANEL_IDS.map((id) => `${rects[id].x.toFixed(1)},${rects[id].y.toFixed(1)},${rects[id].width.toFixed(1)}`).join("|") : "";
    if (key !== rectKey) { rectKey = key; events.panels?.(plaza ? rects : null); }
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
    viewDirty = false; wallDirty = true;
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
    if (snap) { snap = false; Object.assign(lens, { cx: fit.cx, top: fit.top, bottom: fit.bottom, halfW: fit.halfW }); yaw = yawTarget(); orbit = zoomed() ? 1 : 0; }
    applyCamera();
  }
  function paintWall() {
    wallGroup.visible = state.scene === "plaza" && !!wallModel;
    if (!wallDirty || !wallGroup.visible || !wallModel) return;
    wallDirty = false;
    // Text is sized for the readable view; the overview only shrinks the same textures.
    const reference = view.overview ? wallFit(width, height, { plaza: true, ...view, overview: false }) : fit;
    const body = wallBodyPx(reference.ppu), ratio = renderer.getPixelRatio();
    if (metrics.wall) metrics.wall.body = body;
    for (const id of TEXT_PANELS) {
      const p = WALL_PANELS[id], cssW = p.w * reference.ppu, cssH = p.h * WALL_COS * reference.ppu;
      const scale = Math.min(ratio, 2048 / cssW), pxW = Math.max(4, Math.round(cssW * scale)), pxH = Math.max(4, Math.round(cssH * scale));
      const key = JSON.stringify([wallModel[id], pxW, pxH, body, wallStyle]);
      if (drawn[id] === key) continue;
      const c = wallCanvases[id], texture = wallTextures[id];
      // WebGL2 texture storage is immutable: release it before a size change.
      if (c.width !== pxW || c.height !== pxH) { c.width = pxW; c.height = pxH; texture.dispose(); }
      paintWallPanel(id, c, wallModel, { width: cssW, height: cssH, scale: pxW / cssW, body }, wallStyle);
      texture.needsUpdate = true; drawn[id] = key;
    }
    const src = wallModel.pierrot.src;
    if (src !== pierrotSrc) {
      pierrotSrc = src; drawn.pierrot = src;
      let texture = pierrotCache.get(src);
      if (!texture) {
        // Original 300×200 artwork, full frame: no crop or redraw.
        texture = loader.load(src, () => { if (!disposed) draw(); });
        texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
        textures.push(texture); pierrotCache.set(src, texture);
      }
      pierrotMaterial.map = texture; pierrotMaterial.color.set(0xffffff); pierrotMaterial.needsUpdate = true;
    }
  }
  const project = (point: THREE.Vector3) => { const p = point.project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; };
  function draw(time = performance.now()) {
    if (disposed) return;
    resize();
    const dt = Math.min(.05, lastTime ? (time - lastTime) / 1000 : 0); lastTime = time;
    if (lens.cx !== fit.cx || lens.halfW !== fit.halfW || lens.top !== fit.top || lens.bottom !== fit.bottom) {
      // Section pan / overview zoom: ~300 ms ease, immediate when paused.
      const k = state.paused ? 1 : 1 - Math.exp(-dt * 10);
      for (const key of ["cx", "top", "bottom", "halfW"] as const) {
        lens[key] += (fit[key] - lens[key]) * k;
        if (Math.abs(fit[key] - lens[key]) < 1e-3) lens[key] = fit[key];
      }
      applyCamera();
    }
    paintWall();
    const moving = !state.paused && path.length > 0;
    if (moving) {
      const target = path[0], dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
      direction = Math.abs(dx) > Math.abs(dz) ? dx < 0 ? 1 : 2 : dz < 0 ? 3 : 0;
      heading8 = facing8(dx, dz);
      if (distance > 1e-6) visitorLean = leanOf(dx / distance, visitorLean);
      if (distance < dt * 3) { position.x = target.x; position.z = target.z; path.shift(); }
      else { position.x += dx / distance * dt * 3; position.z += dz / distance * dt * 3; }
    }
    const turn = yawTarget(), mode = zoomed() ? 1 : 0;
    if (yaw !== turn || orbit !== mode) {
      yaw += (turn - yaw) * (state.paused ? 1 : 1 - Math.exp(-dt * 3));
      orbit += (mode - orbit) * (state.paused ? 1 : 1 - Math.exp(-dt * 10));
      if (Math.abs(turn - yaw) < 1e-4) yaw = turn;
      if (Math.abs(mode - orbit) < 1e-3) orbit = mode;
      applyCamera();
    }
    const sum = summary();
    amber.intensity = sum.total < 3 ? 32 : 30 + (sum.hope_ratio ?? 0) * 34;
    warning.intensity = sum.total < 3 ? 12 : 12 + (sum.fear_ratio ?? 0) * 35;
    const obstacles = worldObstacles(state.scene), plaza = state.scene === "plaza";
    if (plaza) {
      // The crowd follows the settled frame (`fit`), not the easing lens: a moving centre would read as a section change.
      // In the zoomed section view the section arrows sit on the front of the floor: keep the crowd clear of them.
      const env = { obstacles, front: zoomed() ? Math.max(.8, front - 1.2) : front, visitor: position, restless: sum.mood === "mixed",
        view: { cx: fit.cx, halfW: fit.halfW, camZ: WALL_PANEL_Z + CAMERA_DISTANCE, dist: CAMERA_DISTANCE, zoomed: zoomed() } };
      crowd.sync(sideList.length, env);
      if (!state.paused) crowd.step(dt, env);
    }
    let cueCount = 0;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const cue = (puff: boolean, x: number, y: number, z: number, w: number, h: number) => {
      const n = cueCount++;
      cueRects[n * 4] = puff ? .5 : 0; cueRects[n * 4 + 1] = 0; cueRects[n * 4 + 2] = .5; cueRects[n * 4 + 3] = 1;
      dummy.position.set(x, y, z + .05); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(w, h / WALL_COS, 1); dummy.updateMatrix(); cues.setMatrixAt(n, dummy.matrix);
    };
    for (let i = 0; i < ants.count; i++) {
      const visitor = i === sideList.length, side = sideList[i];
      if (!plaza) {
        let x = visitor ? position.x : -6.6 + (i * 73 % 130) / 10;
        let z = visitor ? position.z : -1.7 + (i * 37 % 75) / 10;
        if (!visitor && state.scene === "battle") { x = side === "bullish" ? -6.4 + (i * 29 % 45) / 10 : side === "bearish" ? 2 + (i * 31 % 45) / 10 : -3 + (i * 17 % 60) / 10; if (side === "neutral") z = 5.8; }
        if (!visitor && !walkable({ x, z }, obstacles)) z = 3.2 + i % 3 * .15;
        const shift = state.paused || visitor ? 0 : Math.sin(time / 2400 + i * 1.7) * .025;
        let row = visitor ? moving ? 1 + Math.floor(time / 180) % 2 : 0 : side === "bearish" ? 3 : side === "bullish" ? 4 : 0;
        let column = visitor ? direction : i % 4;
        // Mixed sentiment: short steps, pauses, and turns in opposite directions.
        // Phase offsets keep the crowd from moving in unison. Counts and evidence stay unchanged.
        if (!visitor && !state.paused && sum.mood === "mixed" && side !== "neutral") {
          const phase = (time / 900 + i * .73) % 4;
          const goingRight = phase < 2;
          const stepping = phase < 1 || (phase >= 2 && phase < 3);
          const progress = stepping ? phase % 1 : 1;
          const offset = goingRight ? -.28 + .56 * progress : .28 - .56 * progress;
          if (walkable({ x: x + offset, z }, obstacles)) x += offset;
          column = goingRight ? 2 : 1;
          row = stepping ? 1 + Math.floor(time / 180 + i) % 2 : 0;
        }
        const rect = antAtlas.cells[row][column];
        offsets[i * 4] = rect[0] / antAtlas.width; offsets[i * 4 + 1] = 1 - (rect[1] + rect[3]) / antAtlas.height;
        offsets[i * 4 + 2] = rect[2] / antAtlas.width; offsets[i * 4 + 3] = rect[3] / antAtlas.height;
        const scale = (visitor ? 1.12 : .9 + i % 3 * .06) * 1.45 / 235;
        // The frame squeezes heights by WALL_COS; sprites are stretched back so they keep their proportions.
        const tall = rect[3] * scale / WALL_COS;
        dummy.position.set(x, shift + tall / 2, z); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(rect[2] * scale, tall, 1); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix);
        ants.setColorAt(i, color.set(visitor ? state.color : "#ffffff"));
        dummy.position.set(x, .025, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, .55, 1); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix);
        continue;
      }
      // Plaza: the visitor keeps its own walk; NPCs follow the crowd simulation (roam, gaze at the wall, phone, sigh).
      const a = visitor ? null : crowd.ants[i];
      const x = a ? a.x : position.x, z = a ? a.z : position.z;
      const dir4 = a ? facing4(a.hx, a.hz) : [0, 2, 6, 4][direction];
      const variant: AntVariant = side === "bearish" ? "fear" : side === "bullish" ? "hope" : "neutral";
      let dir8 = a ? facing8(a.hx, a.hz) : heading8, pose: AntPose = a ? a.pose : moving ? Math.floor(time / 180) % 2 ? "walk-b" : "walk-a" : "idle";
      if (a && a.state === "walk") ({ pose, dir8 } = antWalkFrame(hasFrame, variant, pose, dir8, dir4, a.stride));
      // Camera-facing art is a three-quarter view: `lean` turns it to the side the ant is heading (mirrored where needed).
      const lean = a ? a.lean : visitorLean;
      const frame = frameOf(a ? variant : "neutral", pose, dir8, dir4, lean);
      const rect = frame.rect, k = rect[4] ?? 1;
      offsets[i * 4] = (frame.mirror ? rect[0] + rect[2] : rect[0]) / antAtlas.width; offsets[i * 4 + 1] = 1 - (rect[1] + rect[3]) / antAtlas.height;
      offsets[i * 4 + 2] = (frame.mirror ? -rect[2] : rect[2]) / antAtlas.width; offsets[i * 4 + 3] = rect[3] / antAtlas.height;
      const scale = (visitor ? 1.12 : .9 + i % 3 * .06) * 1.45 / 235 * k;
      // Standing ants breathe; a sigh sinks and recovers over its span (t counts down from span).
      // Walkers bounce once per step.
      const bob = a && a.state === "gaze" && !state.paused ? Math.sin(time / 2400 + i * 1.7) * .025
        : a && a.state === "walk" && a.moved ? Math.abs(Math.sin(a.stride / .48 * Math.PI)) * .05 : 0;
      const sighing = a && a.state === "sigh" && a.span > 0 ? 1 - a.t / a.span : -1;
      const tall = rect[3] * scale / WALL_COS * (sighing >= 0 ? 1 - .06 * Math.sin(Math.PI * sighing) : 1);
      // Each frame's body anchor (ax) stands on the ant's floor point, so poses of different widths do not shake sideways.
      const slide = a ? (rect[2] / 2 - (rect[5] ?? rect[2] / 2)) * scale * (frame.mirror ? -1 : 1) : 0;
      dummy.position.set(x + right.x * slide, bob + tall / 2, z + right.z * slide); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(rect[2] * scale, tall, 1); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix);
      ants.setColorAt(i, color.set(visitor ? state.color : "#ffffff"));
      dummy.position.set(x, .025, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, .55, 1); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix);
      if (a && cueCount < 48) {
        const high = rect[3] * scale / WALL_COS;
        if (a.state === "phone" && !frame.posed && dir4 !== 4) {
          const off = dir4 === 0 ? .12 * lean : dir4 === 2 ? -.2 : .2;
          cue(false, x + right.x * off, high * .62, z + right.z * off, .16, .22);
        } else if (sighing >= .15 && sighing <= .85) {
          // The breath leaves the mouth (beside the hidden face in the back view), drifts outward and rises.
          const off = (dir4 === 0 ? .3 * lean : dir4 === 2 ? -.36 : dir4 === 6 ? .36 : .3) * (1 + sighing * .25), size = .3 * (.6 + sighing);
          cue(true, x + right.x * off, high * (dir4 === 4 ? .66 : dir4 === 0 ? .5 : .56) + sighing * .4, z + right.z * off, size, size);
        }
      }
    }
    cues.count = cueCount; cues.visible = cueCount > 0;
    if (cueCount) { cues.instanceMatrix.needsUpdate = true; (cueGeometry.getAttribute("atlasRect") as THREE.InstancedBufferAttribute).needsUpdate = true; }
    ants.instanceMatrix.needsUpdate = shadows.instanceMatrix.needsUpdate = true; if (ants.instanceColor) ants.instanceColor.needsUpdate = true;
    (antGeometry.getAttribute("atlasRect") as THREE.InstancedBufferAttribute).needsUpdate = true;
    const p = project(new THREE.Vector3(position.x, 1.8, position.z)); events.avatar?.(p.x, p.y, position);
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
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function click(x: number, y: number) {
    raycaster.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 1 - y / height * 2), camera);
    ants.boundingSphere = null; // Instances move every frame: never pick against a stale sphere.
    const hit = raycaster.intersectObject(ants)[0];
    if (hit && hit.instanceId !== undefined && hit.instanceId < sideList.length) { events.evidence?.(sideList[hit.instanceId]); return; }
    const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (target) walkTo({ x: target.x, z: limitZ(target.z) });
  }
  function walkTo(target: Point) {
    if (Math.hypot(target.x - position.x, target.z - position.z) < 1e-3) return; // Already there after clamping.
    path = findWorldPath(position, target, worldObstacles(state.scene)); if (path.length) events.step?.();
  }
  // The floor is only walkable where the framed view shows it.
  const limitZ = (z: number) => Math.min(z, front - .35);
  function update(next: RenderState) {
    const changed = state.scene !== next.scene, density = state.mobile !== next.mobile; state = next;
    if (changed) {
      path = []; snap = true;
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
      view = next; viewDirty = true;
    },
    setWall(model, style) { wallModel = model; if (style) wallStyle = style; wallDirty = true; },
    wallTexture: (id) => wallCanvases[id],
    move(x, z) { const target = { x: position.x + x, z: limitZ(position.z + z) }; if (walkable(target, worldObstacles(state.scene))) walkTo(target); },
    async capture(frame) {
      const target = document.createElement("canvas"); target.width = 1200; target.height = 620; target.style.width = "1200px"; target.style.height = "620px";
      // Export uses the exact scene builder, atlas, lighting and population mapping.
      const exported = await createWorldRenderer(target, { ...state, frame, scene: "theater", mobile: false, paused: true });
      try { exported.draw(0); const copy = document.createElement("canvas"); copy.width = target.width; copy.height = target.height; copy.getContext("2d")!.drawImage(target, 0, 0); return copy; }
      finally { exported.dispose(); }
    },
    dispose() {
      disposed = true; canvas.removeEventListener("webglcontextlost", lost);
      scene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); geometry.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); queries.forEach((q) => gl.deleteQuery(q)); queries = [];
      renderer.dispose();
    }
  };
}
