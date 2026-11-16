import * as THREE from "three";
import type { Point } from "@/lib/world-navigation";
import { MOVE_MARKER, markerLook } from "@/lib/world-move-marker";

/** What the marker drew last: its floor point and look, or null when hidden. */
export type MoveMarkerState = Point & { opacity: number; scale: number };

export type MoveMarker = {
  readonly mesh: THREE.Mesh;
  /** A floor click set the visitor off for `at`: the ring drops in there (replacing any earlier one). */
  show: (at: Point) => void;
  /** The walk was replaced by one nobody clicked for (arrow keys, a section change) or cancelled: gone at once. */
  hide: () => void;
  /** Every frame. `walking` false means the visitor has arrived, so the ring fades out; `size` is the sprite scale (antSize). */
  tick: (time: number, frame: { walking: boolean; reduced: boolean; size: number }) => void;
  readonly state: MoveMarkerState | null;
  dispose: () => void;
};

/** Ring art: a bright pixel ring with a dark rim and a small centre dot, drawn at atlas-like resolution (nearest filtering). */
function ringTexture() {
  const n = 32, c = n / 2, canvas = document.createElement("canvas"); canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!, image = ctx.createImageData(n, n);
  const paint = (i: number, rgba: [number, number, number, number]) => image.data.set(rgba, i * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot(x + .5 - c, y + .5 - c), i = y * n + x;
    if (r >= 10.4 && r < 13.6 || r < 2.2) paint(i, [240, 220, 174, 255]); // ring and dot, the "prompt" tag's ink
    else if (r >= 9.2 && r < 10.4 || r >= 13.6 && r < 15 || r >= 2.2 && r < 3.4) paint(i, [19, 36, 42, 210]); // dark rim
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  return texture;
}

/** Flat ring lying on the floor at the visitor's walk target (see lib/world-move-marker.ts for its timing). */
export function createMoveMarker(): MoveMarker {
  const texture = ringTexture(), geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // Over the floor and the ants' contact shadows (y .025), under the ants; scenery in front still hides it.
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: .02 });
  const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.renderOrder = 1; mesh.position.y = .03;
  let target: Point | null = null, placed: number | null = null, arrived: number | null = null, drawn: MoveMarkerState | null = null;
  const hide = () => { target = null; drawn = null; mesh.visible = false; };
  return {
    mesh,
    get state() { return drawn; },
    show(at) { target = { x: at.x, z: at.z }; placed = arrived = null; mesh.position.x = at.x; mesh.position.z = at.z; },
    hide,
    tick(time, { walking, reduced, size }) {
      if (!target) return;
      placed ??= time;
      if (!walking) arrived ??= time;
      const look = markerLook((time - placed) / 1000, arrived === null ? null : (time - arrived) / 1000, reduced);
      if (!look) { hide(); return; }
      const d = 2 * MOVE_MARKER.radius * size * look.scale;
      mesh.scale.set(d, 1, d); material.opacity = look.opacity; mesh.visible = true;
      drawn = { ...target, ...look };
    },
    dispose() { geometry.dispose(); material.dispose(); texture.dispose(); }
  };
}
