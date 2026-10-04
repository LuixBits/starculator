/**
 * Colours for the 3D hold, hard-coded from docs/design.md so the scene never
 * has to read CSS custom properties (Three.js materials want plain hex).
 */

/** --crate-1 … --crate-7: one per container group, in order. */
export const CRATE_PALETTE: readonly string[] = [
	'#ff5ed1',
	'#35e6e6',
	'#ffd36e',
	'#bfa0ff',
	'#7cf5b3',
	'#ff8a5c',
	'#d8f55c'
];

export const SCENE_COLORS = {
	/** --bg-deep: scene background and fog. */
	bgDeep: '#160a30',
	/** --accent: magenta floor sections, door markers. */
	accent: '#ff5ed1',
	/** --accent-2: cyan grid edges and work light. */
	accent2: '#35e6e6',
	/** --fg: selection outline. */
	fg: '#ffe9ff',
	/** --metal: ship silhouette. */
	metal: '#8b747d',
	/** Hemisphere sky (violet) and ground. */
	skyViolet: '#7b4bd6',
	groundViolet: '#160a30'
} as const;

/** Wraps any integer (including negatives) onto the palette. */
export function crateColor(colorIndex: number): string {
	const n = CRATE_PALETTE.length;
	const i = ((Math.trunc(colorIndex) % n) + n) % n;
	return CRATE_PALETTE[i];
}

interface Rgb {
	r: number;
	g: number;
	b: number;
}

function parseHex(hex: string): Rgb {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) throw new Error(`palette: not a 6-digit hex colour: ${hex}`);
	const v = Number.parseInt(m[1], 16);
	return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function toHex({ r, g, b }: Rgb): string {
	const clamp = (c: number) => Math.min(255, Math.max(0, Math.round(c)));
	return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
}

/** Linear blend in sRGB; t = 0 gives `from`, t = 1 gives `to`. */
export function mixHex(from: string, to: string, t: number): string {
	const a = parseHex(from);
	const b = parseHex(to);
	const k = Math.min(1, Math.max(0, t));
	return toHex({
		r: a.r + (b.r - a.r) * k,
		g: a.g + (b.g - a.g) * k,
		b: a.b + (b.b - a.b) * k
	});
}

/**
 * Pulls a colour towards its own grey (same lightness) by `amount` in [0, 1].
 * Used for crate bodies so the emissive tint carries the saturation instead.
 */
export function desaturateHex(hex: string, amount: number): string {
	const c = parseHex(hex);
	const grey = (Math.max(c.r, c.g, c.b) + Math.min(c.r, c.g, c.b)) / 2;
	return mixHex(hex, toHex({ r: grey, g: grey, b: grey }), amount);
}
