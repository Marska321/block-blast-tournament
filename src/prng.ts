export interface PRNG {
  next(): number;
  nextInt(min: number, max: number): number;
}

/**
 * Mulberry32 is a simple, fast 32-bit PRNG with excellent distribution.
 * Given identical seeds, client and server produce identical sequences.
 */
export function createRNG(seed: number): PRNG {
  let state = seed >>> 0;

  return {
    next(): number {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min)) + min;
    },
  };
}
