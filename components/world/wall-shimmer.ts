import * as THREE from "three";

export type ShimmerRect = { x: number; y: number; w: number; h: number };

/** A light band sweeping over wall boards that are still loading. Owns its meshes, material and geometry. */
export type WallShimmer = {
  /** Shows the sweep over `rect` for board `id`, or hides it (`null`). */
  set(id: string, rect: ShimmerRect | null): void;
  isActive(id: string): boolean;
  /** Advances the sweep; `seconds` is any monotonic clock. Not calling it leaves the band parked off the board. */
  tick(seconds: number): void;
  dispose(): void;
};

/** Seconds per sweep across a board. */
const PERIOD = 1.6;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// A soft diagonal band travels left to right, then rests off-board for a beat before the next pass.
// At phase 0 the band sits fully left of the board, so a parked (reduced-motion) shimmer is invisible.
const fragmentShader = /* glsl */ `
  uniform float uPhase;
  varying vec2 vUv;
  void main() {
    float centre = uPhase * 1.8 - 0.4;
    float d = abs(vUv.x + (vUv.y - 0.5) * 0.3 - centre);
    gl_FragColor = vec4(0.87, 0.82, 0.68, smoothstep(0.22, 0.0, d) * 0.12);
  }
`;

/**
 * Overlay planes `offset` in front of the board plane at `z`, inside `parent` (so they follow its visibility).
 * Planes are created on first use per id and share one material; hidden planes cost nothing to draw.
 */
export function createWallShimmer(parent: THREE.Object3D, z: number, offset = .01): WallShimmer {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { uPhase: { value: 0 } }, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, fog: false, toneMapped: false
  });
  const meshes = new Map<string, THREE.Mesh>();
  return {
    set(id, rect) {
      let mesh = meshes.get(id);
      if (!rect) { if (mesh) mesh.visible = false; return; }
      if (!mesh) {
        mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
        parent.add(mesh); meshes.set(id, mesh);
      }
      mesh.position.set(rect.x, rect.y, z + offset); mesh.scale.set(rect.w, rect.h, 1); mesh.visible = true;
    },
    isActive: (id) => meshes.get(id)?.visible ?? false,
    tick(seconds) { material.uniforms.uPhase.value = (seconds / PERIOD) % 1; },
    dispose() { for (const mesh of meshes.values()) mesh.removeFromParent(); meshes.clear(); geometry.dispose(); material.dispose(); }
  };
}
