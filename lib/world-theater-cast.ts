import type { Point } from "./world-navigation";
import type { WorldSummary } from "./world";

export const THEATER_STAGE = { x: 0, z: -2, width: 10, depth: 3, height: .7 };
export const THEATER_CHAIR = { width: 1.2, depth: .65, seatY: .5, backZ: .35, backDepth: .15, backHeight: .79 };
export const THEATER_SEATS: Point[] = Array.from({ length: 10 }, (_, i) => ({
  x: (i % 5 - 2) * 1.7 + (i < 5 ? 0 : .85),
  z: i < 5 ? 3.6 : 6.1
}));
export const THEATER_AUDIENCE = [0, 2, 3, 6, 8].map((i) => THEATER_SEATS[i]);
export const THEATER_DOOR = { x: 5.65, half: .7, height: 1.9, insideZ: -5.85 };
export const THEATER_ACTORS = [{ side: "bearish", x: -1.6 }, { side: "bullish", x: 1.6 }] as const;

/** Signed depth offset for hope, in world units. Fear gets the opposite offset. */
export function theaterLead(summary: WorldSummary): number {
  const { total, hope_ratio: hope, fear_ratio: fear } = summary;
  if (total < 3 || hope === null || fear === null || summary.bullish + summary.bearish === 0) return 0;
  return Math.max(-1, Math.min(1, hope - fear));
}

type Trip = "seated" | "out" | "away" | "in";
const TRIP_ORDER: Trip[] = ["seated", "out", "away", "in"];
const seat = THEATER_AUDIENCE[THEATER_AUDIENCE.length - 1];
// Step off the seat toward the cross aisle, turn right, then go behind the doorway's right jamb.
const route: Point[] = [
  seat, { x: seat.x, z: 4.8 }, { x: THEATER_DOOR.x, z: 4.8 },
  { x: THEATER_DOOR.x, z: THEATER_DOOR.insideZ }, { x: THEATER_DOOR.x + 1.25, z: THEATER_DOOR.insideZ }
];
const lengths = route.slice(1).map((end, i) => Math.hypot(end.x - route[i].x, end.z - route[i].z));
const distance = lengths.reduce((sum, length) => sum + length, 0), speed = 1.9;

/** One occupied seat has a round trip. Its two waits count only time spent viewing the theater. */
export function createTheaterAudience(random = Math.random) {
  let phase: Trip = "seated", elapsed = 0, duration = wait();
  function wait() { return 45 + random() * 30; }
  return {
    step(dt: number) {
      elapsed += dt;
      while (elapsed >= duration) {
        elapsed -= duration;
        phase = TRIP_ORDER[(TRIP_ORDER.indexOf(phase) + 1) % TRIP_ORDER.length];
        duration = phase === "seated" || phase === "away" ? wait() : distance / speed;
      }
    },
    spectator() {
      if (phase === "seated" || phase === "away") return { phase, point: phase === "seated" ? seat : route[route.length - 1], dx: 0, dz: -1, stride: 0 };
      const stride = elapsed * speed, direction = phase === "out" ? 1 : -1;
      let left = phase === "out" ? stride : distance - stride, i = 0;
      while (i < lengths.length - 1 && left > lengths[i]) left -= lengths[i++];
      const a = route[i], b = route[i + 1], t = left / lengths[i];
      return {
        phase, stride, point: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        dx: (b.x - a.x) * direction, dz: (b.z - a.z) * direction
      };
    }
  };
}
