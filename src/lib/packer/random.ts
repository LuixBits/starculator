/**
 * Small deterministic PRNG (mulberry32). The packer must give identical results
 * for identical seeds in every runtime, so Math.random is never used.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
	let a = Math.trunc(seed) >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher–Yates shuffle, in place, driven by `rng`. */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const t = arr[i];
		arr[i] = arr[j];
		arr[j] = t;
	}
	return arr;
}
