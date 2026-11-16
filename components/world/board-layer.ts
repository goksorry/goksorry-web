import * as THREE from "three";
import type { BoardRect } from "@/lib/world-wall";
import { createWallShimmer } from "./wall-shimmer";

/** Logical (CSS px) size of a painted board, device scale of its backing canvas and body text size. */
export type BoardBox = { width: number; height: number; scale: number; body: number };
/**
 * What a board shows. `paint` boards draw into a canvas; `key` must change whenever the drawing would
 * (the layer adds the size itself). `image` boards show a picture; an empty `src` leaves the board blank.
 */
export type BoardContent =
  | { kind: "paint"; key: string; paint: (canvas: HTMLCanvasElement, box: BoardBox) => void }
  | { kind: "image"; src: string };
/** One unlit textured plane on the wall. `loading` adds the loading sweep until content arrives. */
export type BoardSpec = { id: string; rect: BoardRect; content: BoardContent; loading: boolean };
/** How large boards appear on screen: CSS px per world unit, vertical squeeze of the view, device ratio, body text px. */
export type BoardScale = { ppu: number; squeeze: number; ratio: number; body: number };

export type BoardLayer = {
  readonly group: THREE.Group;
  /** Replaces the board set; boards keep their GPU resources across calls while their id and kind stay. */
  set(specs: BoardSpec[]): void;
  /** Repaints boards whose content or scale changed since they were last painted. */
  paint(scale: BoardScale): void;
  tick(seconds: number): void;
  /** Ids (in spec order) showing the loading sweep. */
  loading(): string[];
  canvas(id: string): HTMLCanvasElement | undefined;
  /** Last painted key per board (content key and size, or image src). */
  readonly drawn: Record<string, string>;
  dispose(): void;
};

type Entry = { spec: BoardSpec; mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; canvas?: HTMLCanvasElement; texture?: THREE.CanvasTexture };

/** Blank board face (no texture yet). */
const BLANK = 0x101c22;

/**
 * Wall boards for the current scene: one plane each at depth `z`, painted canvases or images, and the loading sweep.
 * `onImage` fires when an image settles (loaded or failed) so a paused view can redraw.
 */
export function createBoardLayer({ z, anisotropy, loader, onImage }: { z: number; anisotropy: number; loader: THREE.TextureLoader; onImage: () => void }): BoardLayer {
  const group = new THREE.Group(); group.visible = false;
  const geometry = new THREE.PlaneGeometry(1, 1);
  const shimmer = createWallShimmer(group, z);
  const entries = new Map<string, Entry>(), drawn: Record<string, string> = {};
  // Images are cached for the life of the layer: scenes and moods swap between a handful of pictures.
  const images = new Map<string, THREE.Texture>(), settled = new Set<string>();
  let order: string[] = [], disposed = false;

  const sweep = (entry: Entry) => {
    const { spec } = entry, content = spec.content;
    const waiting = spec.loading || (content.kind === "image" && !!content.src && !settled.has(content.src));
    shimmer.set(spec.id, waiting ? spec.rect : null);
  };
  const image = (src: string) => {
    let texture = images.get(src);
    if (texture) return texture;
    // A failed image settles too: the sweep means "on its way", not "missing".
    const settle = () => {
      settled.add(src);
      if (disposed) return;
      for (const entry of entries.values()) if (entry.spec.content.kind === "image" && entry.spec.content.src === src) sweep(entry);
      onImage();
    };
    texture = loader.load(src, settle, undefined, settle);
    texture.colorSpace = THREE.SRGBColorSpace; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    images.set(src, texture);
    return texture;
  };
  const remove = (id: string) => {
    const entry = entries.get(id); if (!entry) return;
    entry.mesh.removeFromParent(); entry.material.dispose(); entry.texture?.dispose();
    shimmer.set(id, null); entries.delete(id); delete drawn[id];
  };
  const create = (spec: BoardSpec): Entry => {
    const material = new THREE.MeshBasicMaterial({ color: BLANK, toneMapped: false, fog: false });
    const mesh = new THREE.Mesh(geometry, material); group.add(mesh);
    const entry: Entry = { spec, mesh, material };
    if (spec.content.kind === "paint") {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 4;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = true;
      texture.anisotropy = anisotropy;
      Object.assign(entry, { canvas, texture }); material.map = texture; material.color.set(0xffffff);
    }
    entries.set(spec.id, entry);
    return entry;
  };

  return {
    group, drawn,
    set(specs) {
      const ids = new Set(specs.map((s) => s.id));
      for (const id of [...entries.keys()]) if (!ids.has(id) || entries.get(id)!.spec.content.kind !== specs.find((s) => s.id === id)!.content.kind) remove(id);
      for (const spec of specs) {
        const entry = entries.get(spec.id) ?? create(spec);
        entry.spec = spec;
        entry.mesh.position.set(spec.rect.x, spec.rect.y, z); entry.mesh.scale.set(spec.rect.w, spec.rect.h, 1);
        if (spec.content.kind === "image" && drawn[spec.id] !== spec.content.src) {
          const texture = spec.content.src ? image(spec.content.src) : null;
          entry.material.map = texture; entry.material.color.set(texture ? 0xffffff : BLANK); entry.material.needsUpdate = true;
          drawn[spec.id] = spec.content.src;
        }
        sweep(entry);
      }
      order = specs.map((s) => s.id);
      group.visible = specs.length > 0;
    },
    paint({ ppu, squeeze, ratio, body }) {
      for (const entry of entries.values()) {
        const { spec, canvas, texture } = entry, content = spec.content;
        if (content.kind !== "paint" || !canvas || !texture) continue;
        const cssW = spec.rect.w * ppu, cssH = spec.rect.h * squeeze * ppu;
        // Cap the backing store; a huge board on a high-density screen would exceed texture limits.
        const scale = Math.min(ratio, 2048 / cssW), pxW = Math.max(4, Math.round(cssW * scale)), pxH = Math.max(4, Math.round(cssH * scale));
        const key = `${content.key}|${pxW}x${pxH}|${body}`;
        if (drawn[spec.id] === key) continue;
        // WebGL2 texture storage is immutable: release it before a size change.
        if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; texture.dispose(); }
        content.paint(canvas, { width: cssW, height: cssH, scale: pxW / cssW, body });
        texture.needsUpdate = true; drawn[spec.id] = key;
      }
    },
    tick: (seconds) => shimmer.tick(seconds),
    loading: () => order.filter((id) => shimmer.isActive(id)),
    canvas: (id) => entries.get(id)?.canvas,
    dispose() {
      disposed = true;
      for (const id of [...entries.keys()]) remove(id);
      for (const texture of images.values()) texture.dispose();
      images.clear(); shimmer.dispose(); geometry.dispose(); group.removeFromParent();
    }
  };
}
