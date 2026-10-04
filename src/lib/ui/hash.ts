/**
 * Deterministic pseudo-randomness for decorative scatter (stars, wall wear) so
 * server and client render identical markup. Never use Math.random for layout.
 */
export function hashString(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Returns a function yielding floats in [0, 1) from a numeric seed (mulberry32). */
export function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface ScatterPoint {
	x: number;
	y: number;
	r: number;
	a: number;
}

export function scatter(
	seed: string,
	count: number,
	width: number,
	height: number
): ScatterPoint[] {
	const rnd = seeded(hashString(seed));
	const points: ScatterPoint[] = [];
	for (let i = 0; i < count; i++) {
		points.push({
			x: Math.round(rnd() * width * 10) / 10,
			y: Math.round(rnd() * height * 10) / 10,
			r: Math.round((0.6 + rnd() * 1.4) * 10) / 10,
			a: Math.round((0.25 + rnd() * 0.6) * 100) / 100
		});
	}
	return points;
}
