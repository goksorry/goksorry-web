import * as THREE from "three";

export type ShimmerRect = { x: number; y: number; w: number; h: number };

/** A light band sweeping over wall panels that are still loading. Owns its meshes, material and geometry. */
export type WallShimmer<Id extends string> = {
  /** Turns the sweep on or off for one panel. */
  set(id: Id, active: boolean): void;
  isActive(id: Id): boolean;
  /** Advances the sweep; `seconds` is any monotonic clock. */
  tick(seconds: number): void;
  dispose(): void;
};

/** Seconds per sweep across a panel. */
const PERIOD = 1.6;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// A soft diagonal band travels left to right, then rests off-panel for a beat before the next pass.
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
 * Creates one overlay plane per rect, `offset` in front of the panel plane at `z`, inside `parent`
 * (so the overlay follows the parent's visibility). All overlays share a single material and draw only while active.
 */
export function createWallShimmer<Id extends string>(parent: THREE.Object3D, rects: Record<Id, ShimmerRect>, z: number, offset = .01): WallShimmer<Id> {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { uPhase: { value: 0 } }, vertexShader, fragmentShader,
    transparent: true, depthWrite: false, fog: false, toneMapped: false
  });
  const meshes = new Map<Id, THREE.Mesh>();
  for (const id of Object.keys(rects) as Id[]) {
    const r = rects[id], mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(r.x, r.y, z + offset); mesh.scale.set(r.w, r.h, 1);
    mesh.visible = false; mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
    parent.add(mesh); meshes.set(id, mesh);
  }
  return {
    set(id, active) { const mesh = meshes.get(id); if (mesh) mesh.visible = active; },
    isActive: (id) => meshes.get(id)?.visible ?? false,
    tick(seconds) { material.uniforms.uPhase.value = (seconds / PERIOD) % 1; },
    dispose() { for (const mesh of meshes.values()) mesh.removeFromParent(); meshes.clear(); geometry.dispose(); material.dispose(); }
  };
}
