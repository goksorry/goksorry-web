// Seeded randomness for the world's crowds: no Math.random, so captures and tests are deterministic.

/** A well-mixed 32-bit value for (`seed`, `index`): the starting state of one ant's stream. */
export const hash = (seed: number, index: number): number => {
  let h = (seed ^ Math.imul(index + 1, 0x9E3779B1)) | 0;
  h = Math.imul(h ^ h >>> 16, 0x85EBCA6B); h = Math.imul(h ^ h >>> 13, 0xC2B2AE35);
  return (h ^ h >>> 16) | 0;
};
/** mulberry32's output, 0..1, for a state already advanced. */
export const unit = (state: number): number => {
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
/** The step mulberry32 advances its state by. */
export const advance = (state: number): number => (state + 0x6D2B79F5) | 0;
