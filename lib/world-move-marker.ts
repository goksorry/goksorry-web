/**
 * The ring a floor click leaves on the ground at the visitor's walk target (after path-finding clamped it).
 * It drops in slightly larger and settles, breathes while the visitor walks, and widens as it fades out on
 * arrival. Under reduced motion it is a plain static ring that simply goes away on arrival.
 */
export const MOVE_MARKER = {
  /** Ring radius on the floor, world units, at full sprite size. */
  radius: .42,
  /** Seconds to drop in and settle. */
  appear: .22,
  /** Seconds to fade out after the visitor arrives. */
  vanish: .2,
  /** Seconds per breath while the visitor walks. */
  period: 1.1,
  /** Opacity of a settled ring. */
  opacity: .95
} as const;

export type MarkerLook = { opacity: number; scale: number };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * How the marker is drawn `age` seconds after it was placed; `gone` is the seconds since the visitor arrived (null while
 * it is still walking). Null once the marker has faded out.
 */
export function markerLook(age: number, gone: number | null, reduced: boolean): MarkerLook | null {
  if (reduced) return gone === null ? { opacity: MOVE_MARKER.opacity, scale: 1 } : null;
  const t = Math.max(0, age), settle = 1 - (1 - clamp01(t / MOVE_MARKER.appear)) ** 2;
  // Drops in from 1.4x, then breathes ±6% in size and a little in opacity.
  const breath = t > MOVE_MARKER.appear ? Math.sin(2 * Math.PI * (t - MOVE_MARKER.appear) / MOVE_MARKER.period) : 0;
  let opacity = MOVE_MARKER.opacity * settle * (.85 + .15 * breath), scale = (1.4 - .4 * settle) * (1 + .06 * breath);
  if (gone !== null) {
    const left = 1 - clamp01(gone / MOVE_MARKER.vanish);
    if (left <= 0) return null;
    opacity *= left; scale *= 1 + .3 * (1 - left);
  }
  return { opacity, scale };
}
