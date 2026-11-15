import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldFrame, WorldScene, WorldSide, WorldSummary } from "@/lib/world";
import { crowdDistribution } from "@/lib/world-presentation";
import { findWorldPath, walkable, worldObstacles, type Point } from "@/lib/world-navigation";
import antAtlas from "./ant-atlas.json";

export type RenderState = { frame: WorldFrame; scene: WorldScene; stock: string; mobile: boolean; color: string; paused: boolean };
export type RenderMetrics = { renders: number; frames: number[]; cpu: number[]; gpu: number[]; calls: number; triangles: number; renderer: string; population: number };
export type WorldRenderer = {
  update: (state: RenderState) => void;
  move: (x: number, z: number) => void;
  click: (x: number, y: number) => void;
  draw: (time?: number) => void;
  capture: (frame: WorldFrame) => Promise<HTMLCanvasElement>;
  dispose: () => void;
  metrics: RenderMetrics;
  position: Point;
};
export const SCREEN_POINTS = { index: new THREE.Vector3(-6.2, 3.25, -4), feed: new THREE.Vector3(6.2, 4.2, -4) };

export async function createWorldRenderer(canvas: HTMLCanvasElement, initial: RenderState, events: {
  anchor?: (name: "index" | "feed", x: number, y: number, width: number) => void;
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
  const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, .1, 100);
  camera.position.set(6, 15, 22); camera.lookAt(0, 1, 0);
  const hemi = new THREE.HemisphereLight(0x9ebbd0, 0x3a2c21, 2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xb8c6d0, 2.5); sun.position.set(-8, 18, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14; sun.shadow.bias = -.002;
  scene.add(sun);
  const amber = new THREE.PointLight(0xe8ad60, 50, 19, 2); amber.position.set(-6, 5, -1); scene.add(amber);
  const warning = new THREE.PointLight(0xdb604b, 24, 14, 2); warning.position.set(7, 4, -1); scene.add(warning);
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const geometry: THREE.BufferGeometry[] = [];
  const loader = new THREE.TextureLoader();
  let source: THREE.Texture, atlas: THREE.Texture, anchor: THREE.Texture | undefined;
  try { [source, atlas, anchor] = await Promise.all((initial.scene === "broadcast" ? ["materials", "ants", "anchor"] : ["materials", "ants"]).map((name) => loader.loadAsync(`/world/${name}.png`).then((t) => { textures.push(t); return t; }))); }
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
    box(0, -.38, 0, 23, .75, 17, floorMat);
    // Alley walls, raised landings, masonry entrance, shutters and rusted cornices.
    for (const sign of [-1, 1]) {
      const wall = box(sign * 5.6, 3.3, -5.3, 11.4, 7, .65, brickMat); wall.rotation.y = sign * -.08;
      box(sign * 11.2, 2.1, 0, .7, 4.8, 11, brickMat);
      box(sign * 5.7, 6.9, -5.2, 11.6, .24, 1.1, metalMat);
      box(sign * 5.7, .4, -4.2, 10.6, .8, 1.5, plasterMat);
      for (let j = 0; j < 3; j++) box(sign * 5.5, .1 + j * .12, -3.3 - j * .32, 8.8, .2, .45, brickMat);
      box(sign * 9.6, 1.65, -1, 2.5, 3.3, 3.4, brickMat);
      box(sign * 9.6, 3.4, -1, 3, .24, 4, metalMat);
      arch(sign * 9.2, .76, 1.25, 2.5);
      for (let j = 0; j < 6; j++) box(sign * 8.1, 2.5 + j * .2, -4.76, 1.4, .08, .12, metalMat);
      box(sign * 8.1, 4.7, -4.5, .4, .55, .35, glowMat);
      box(sign * 8.1, 4.35, -4.6, .65, .12, .6, metalMat);
      const pipe = mesh(new THREE.CylinderGeometry(.07, .07, 5.2, 6), metalMat, sign * 10.4, 2.6, -4.7);
      pipe.castShadow = false;
    }
    arch(0, -4.9, 2.3, 3.4);
    box(0, 4.3, -4.65, 2.9, .8, .18, metalMat);
    for (let i = 0; i < 5; i++) box(-.9 + i * .45, 4.3, -4.5, .14, .1, .02, glowMat);
    cable([new THREE.Vector3(-11, 6.3, -3.4), new THREE.Vector3(-3, 5.8, -2.9), new THREE.Vector3(4, 6.1, -3), new THREE.Vector3(11, 6.6, -3.5)]);
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
  const boardGroup = new THREE.Group(); scene.add(boardGroup);
  const boards = (["index", "feed"] as const).map((name) => {
    const group = new THREE.Group(); group.position.copy(SCREEN_POINTS[name]); group.quaternion.copy(camera.quaternion); boardGroup.add(group);
    box(0, 0, -.15, 1, 1, .25, metalMat, group);
    box(0, 0, .01, .96, .94, .04, darkMat, group);
    for (const x of [-.47, .47]) for (const y of [-.45, .45]) box(x, y, .05, .018, .018, .02, glowMat, group);
    return group;
  });
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
  const anchorMaterial = new THREE.MeshBasicMaterial({ map: anchor ?? null, transparent: true, alphaTest: .1 }); materials.push(anchorMaterial);
  const anchorGeometry = new THREE.PlaneGeometry(3.8, 3.5); geometry.push(anchorGeometry);
  const announcer = mesh(anchorGeometry, anchorMaterial, 0, 2.2, -.7, scene as unknown as THREE.Group); announcer.quaternion.copy(camera.quaternion); announcer.castShadow = false;
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const position: Point = { x: 0, z: 3.2 };
  let path: Point[] = [], sideList: WorldSide[] = [], lastTime = 0, lastRender = 0, disposed = false;
  let width = 0, height = 0, direction = 0, anchorRequest = 0;
  const cameraUp = new THREE.Vector3();
  function updateAnchor() {
    const request = ++anchorRequest;
    if (state.scene !== "broadcast") {
      if (anchor) { anchor.dispose(); textures.splice(textures.indexOf(anchor), 1); anchor = undefined; anchorMaterial.map = null; anchorMaterial.needsUpdate = true; }
      return;
    }
    if (anchor) return;
    void loader.loadAsync("/world/anchor.png").then((texture) => {
      if (disposed || request !== anchorRequest || state.scene !== "broadcast") { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
      textures.push(texture); anchor = texture; anchorMaterial.map = texture; anchorMaterial.needsUpdate = true;
    }).catch(() => { if (!disposed && request === anchorRequest) events.failure?.(); });
  }
  const metrics: RenderMetrics = { renders: 0, frames: [], cpu: [], gpu: [], calls: 0, triangles: 0, renderer: "", population: 0 };
  const gl = renderer.getContext() as WebGL2RenderingContext; const debug = gl.getExtension("WEBGL_debug_renderer_info");
  metrics.renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "WebGL";
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  let queries: WebGLQuery[] = [];
  function summary(): WorldSummary { return state.scene === "battle" || state.scene === "ecosystem" ? state.frame.stocks.find((s) => s.symbol === state.stock) ?? state.frame.overall : state.frame.overall; }
  function population() {
    const counts = crowdDistribution(summary(), state.mobile ? 23 : 47);
    sideList = (["bullish", "bearish", "neutral"] as const).flatMap((side) => Array.from({ length: counts[side] }, () => side));
    ants.count = shadows.count = sideList.length + 1; metrics.population = ants.count;
  }
  function resize() {
    const w = canvas.clientWidth || 1200, h = canvas.clientHeight || 680;
    if (width === w && height === h) return;
    width = w; height = h;
    // Pixel-art raster budget is independent of the crisp HTML information.
    // Avoid filling a Retina-sized framebuffer for deliberately coarse sprites.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.mobile ? 1.25 : 1024 / w)); renderer.setSize(w, h, false);
    const halfH = state.mobile ? 7.4 : Math.max(9, 14 * h / w);
    camera.left = -halfH * w / h; camera.right = halfH * w / h; camera.top = halfH; camera.bottom = -halfH;
    camera.position.set(state.mobile ? 7.8 : 6, 15, 22); camera.lookAt(state.mobile ? 1.8 : 0, 1, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    boards.forEach((board, i) => {
      const boardWidth = state.mobile ? 330 : Math.min(380, Math.max(310, w * .28));
      const unitsPerPixel = 2 * halfH / h;
      board.scale.set(boardWidth * unitsPerPixel, 282 * unitsPerPixel, 1);
      board.quaternion.copy(camera.quaternion);
      const p = SCREEN_POINTS[i ? "feed" : "index"].clone().project(camera);
      events.anchor?.(i ? "feed" : "index", (p.x + 1) * w / 2, (1 - p.y) * h / 2, boardWidth - 18);
    });
  }
  const project = (point: THREE.Vector3) => { const p = point.project(camera); return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 }; };
  function draw(time = performance.now()) {
    if (disposed) return;
    resize();
    const dt = Math.min(.05, lastTime ? (time - lastTime) / 1000 : 0); lastTime = time;
    const moving = !state.paused && path.length > 0;
    if (moving) {
      const target = path[0], dx = target.x - position.x, dz = target.z - position.z, distance = Math.hypot(dx, dz);
      direction = Math.abs(dx) > Math.abs(dz) ? dx < 0 ? 1 : 2 : dz < 0 ? 3 : 0;
      if (distance < dt * 3) { position.x = target.x; position.z = target.z; path.shift(); }
      else { position.x += dx / distance * dt * 3; position.z += dz / distance * dt * 3; }
    }
    const sum = summary();
    amber.intensity = sum.total < 3 ? 32 : 30 + (sum.hope_ratio ?? 0) * 34;
    warning.intensity = sum.total < 3 ? 12 : 12 + (sum.fear_ratio ?? 0) * 35;
    announcer.visible = state.scene === "broadcast" && !!anchor;
    boardGroup.visible = state.scene === "plaza";
    const obstacles = worldObstacles(state.scene);
    for (let i = 0; i < ants.count; i++) {
      const visitor = i === sideList.length, side = sideList[i];
      let x = visitor ? position.x : -6.6 + (i * 73 % 130) / 10;
      let z = visitor ? position.z : -1.7 + (i * 37 % 75) / 10;
      if (!visitor && state.scene === "battle") { x = side === "bullish" ? -6.4 + (i * 29 % 45) / 10 : side === "bearish" ? 2 + (i * 31 % 45) / 10 : -3 + (i * 17 % 60) / 10; if (side === "neutral") z = 5.8; }
      if (!visitor && !walkable({ x, z }, obstacles)) z = 3.2 + i % 3 * .15;
      const shift = state.paused || visitor ? 0 : Math.sin(time / 2400 + i * 1.7) * .025;
      const row = visitor ? moving ? 1 + Math.floor(time / 180) % 2 : 0 : side === "bearish" ? 3 : side === "bullish" ? 4 : 0;
      const column = visitor ? direction : i % 4;
      const rect = antAtlas.cells[row][column];
      offsets[i * 4] = rect[0] / antAtlas.width; offsets[i * 4 + 1] = 1 - (rect[1] + rect[3]) / antAtlas.height;
      offsets[i * 4 + 2] = rect[2] / antAtlas.width; offsets[i * 4 + 3] = rect[3] / antAtlas.height;
      const scale = (visitor ? 1.12 : .9 + i % 3 * .06) * 1.45 / 235;
      dummy.position.set(x, shift, z).addScaledVector(cameraUp, rect[3] * scale / 2); dummy.quaternion.copy(camera.quaternion); dummy.scale.set(rect[2] * scale, rect[3] * scale, 1); dummy.updateMatrix(); ants.setMatrixAt(i, dummy.matrix);
      ants.setColorAt(i, color.set(visitor ? state.color : "#ffffff"));
      dummy.position.set(x, .025, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, .55, 1); dummy.updateMatrix(); shadows.setMatrixAt(i, dummy.matrix);
    }
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
    const hit = raycaster.intersectObject(ants)[0];
    if (hit && hit.instanceId !== undefined && hit.instanceId < sideList.length) { events.evidence?.(sideList[hit.instanceId]); return; }
    const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (target) { path = findWorldPath(position, { x: target.x, z: target.z }, worldObstacles(state.scene)); if (path.length) events.step?.(); }
  }
  function update(next: RenderState) {
    const changed = state.scene !== next.scene; state = next;
    if (changed) { path = []; if (!walkable(position, worldObstacles(state.scene))) { position.x = 0; position.z = 3.2; } buildRoom(); updateAnchor(); }
    if (state.paused) { lastTime = lastRender = 0; }
    population(); width = 0;
  }
  const lost = (event: Event) => { event.preventDefault(); events.failure?.(); }; canvas.addEventListener("webglcontextlost", lost);
  buildRoom(); population();
  return {
    update, draw, click, metrics, position,
    move(x, z) { const target = { x: position.x + x, z: position.z + z }; if (walkable(target, worldObstacles(state.scene))) { path = findWorldPath(position, target, worldObstacles(state.scene)); if (path.length) events.step?.(); } },
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
