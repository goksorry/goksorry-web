import * as THREE from "three";

/** `name`: the visitor's tag; `peer`: another viewer's tag; `sign`: a door's name plate, mounted on the scenery (ants in front of it hide it);
 * `prompt`: a highlighted call to action. */
export type LabelStyle = "name" | "peer" | "sign" | "prompt";
/** A text tag standing on `at` (its bottom centre), facing the camera. */
export type LabelSpec = { id: string; text: string; style: LabelStyle; at: { x: number; y: number; z: number } };

export type LabelLayer = {
  readonly group: THREE.Group;
  /** Replaces the label set; unchanged text keeps its texture, so calling this every frame is cheap. */
  set(labels: LabelSpec[]): void;
  setFont(family: string): void;
  /** Screen rectangle (CSS px) of each label after the last `measure`. */
  measure(camera: THREE.Camera, width: number, height: number): Record<string, { x: number; y: number; width: number; height: number }>;
  dispose(): void;
};

/** World height of each style's tag, its colours, whether scenery and ants in front of it hide it (`depth`), and its text size and
 * side padding as fractions of the tag height (default .62 and .3). */
const STYLE: Record<LabelStyle, { height: number; ink: string; bg: string; border: string; weight: number; depth?: boolean; text?: number; pad?: number }> = {
  name: { height: .36, ink: "#e6c37d", bg: "#13242ade", border: "#a28551", weight: 600 },
  peer: { height: .3, ink: "#d4dcd8", bg: "#13242ac4", border: "#6b7f80", weight: 500 },
  sign: { height: .38, ink: "#e8d09a", bg: "#17130df2", border: "#8a734f", weight: 700, depth: true, text: .66, pad: .2 },
  prompt: { height: .42, ink: "#f0dcae", bg: "#2a2416ee", border: "#d9b777", weight: 700 }
};
/** Canvas pixels per world unit of tag height; mipmaps cover the smaller on-screen sizes. */
const PX = 96;

type Entry = { key: string; sprite: THREE.Sprite; material: THREE.SpriteMaterial; texture: THREE.CanvasTexture };

/** Camera-facing text tags drawn over the scene (never hidden behind ants or scenery, except the depth-tested door plates). */
export function createLabelLayer(): LabelLayer {
  const group = new THREE.Group();
  const entries = new Map<string, Entry>();
  let family = "sans-serif";
  const corner = new THREE.Vector3();

  const paint = (text: string, style: LabelStyle) => {
    const s = STYLE[style], size = Math.round(PX * (s.text ?? .62)), padX = Math.round(PX * (s.pad ?? .3));
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d")!;
    const font = `${s.weight} ${size}px ${family}`;
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(text).width + padX * 2); canvas.height = PX;
    ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = s.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = s.border; ctx.lineWidth = 4; ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = s.ink; ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { texture, aspect: canvas.width / canvas.height };
  };
  const remove = (id: string) => {
    const entry = entries.get(id); if (!entry) return;
    entry.sprite.removeFromParent(); entry.material.dispose(); entry.texture.dispose(); entries.delete(id);
  };

  return {
    group,
    set(labels) {
      const ids = new Set(labels.map((l) => l.id));
      for (const id of [...entries.keys()]) if (!ids.has(id)) remove(id);
      for (const label of labels) {
        const key = `${label.style}|${label.text}|${family}`;
        let entry = entries.get(label.id);
        if (entry && entry.key !== key) { remove(label.id); entry = undefined; }
        if (!entry) {
          const { texture, aspect } = paint(label.text, label.style), height = STYLE[label.style].height;
          const material = new THREE.SpriteMaterial({ map: texture, depthTest: !!STYLE[label.style].depth, depthWrite: false, fog: false, toneMapped: false });
          const sprite = new THREE.Sprite(material); sprite.center.set(.5, 0); sprite.scale.set(height * aspect, height, 1); sprite.renderOrder = 10;
          group.add(sprite); entry = { key, sprite, material, texture }; entries.set(label.id, entry);
        }
        entry.sprite.position.set(label.at.x, label.at.y, label.at.z);
      }
    },
    setFont(next) { if (next !== family) { family = next; for (const id of [...entries.keys()]) remove(id); } },
    measure(camera, width, height) {
      const rects: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const [id, { sprite }] of entries) {
        // A sprite faces the camera: its screen box spans its centre-bottom anchor up by its height.
        const base = corner.copy(sprite.position).project(camera), bx = (base.x + 1) * width / 2, by = (1 - base.y) * height / 2;
        const top = corner.copy(sprite.position).setY(sprite.position.y + sprite.scale.y).project(camera), ty = (1 - top.y) * height / 2;
        const h = by - ty, w = h * sprite.scale.x / sprite.scale.y;
        rects[id] = { x: bx - w / 2, y: ty, width: w, height: h };
      }
      return rects;
    },
    dispose() { for (const id of [...entries.keys()]) remove(id); group.removeFromParent(); }
  };
}
