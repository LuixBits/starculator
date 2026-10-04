/**
 * Turning game class names into ids, labels and slugs.
 *
 * A grid class such as DRAK_Caterpillar_CargoInventory_Module_Walkway splits at
 * the CargoGrid / CargoInventory marker: the tokens after it ("Module",
 * "Walkway") describe the grid. Noise tokens the game adds (Cargo, IC, TEMP,
 * Template, capacity numbers) and tokens that merely repeat the ship's own
 * class name (C2, Titan, DUR) are stripped so that labels read "Main", "Rear",
 * "Module 1 walkway".
 */

const MARKER = /^(cargogrid(ic)?|cargoinventory)$/i;
const NOISE = /^(cargo|ic|temp|template|base|is|\d+(scu)?)$/i;

/** Tokens of a ClassName-like identifier, split on underscores. */
export function classTokens(className: string): string[] {
	return className.split('_').filter((t) => t.length > 0);
}

export interface SplitClass {
	/** Tokens before the CargoGrid/CargoInventory marker (manufacturer, ship, variant). */
	before: string[];
	/** Tokens after the marker, describing the grid. */
	after: string[];
}

export function splitGridClass(gridClass: string): SplitClass {
	const tokens = classTokens(gridClass);
	const at = tokens.findIndex((t) => MARKER.test(t));
	if (at < 0) return { before: [], after: tokens };
	return { before: tokens.slice(0, at), after: tokens.slice(at + 1) };
}

export function stripNoise(tokens: readonly string[]): string[] {
	return tokens.filter((t) => !NOISE.test(t));
}

export function stripShipTokens(tokens: readonly string[], shipClassName: string): string[] {
	const ship = new Set(classTokens(shipClassName).map((t) => t.toLowerCase()));
	return tokens.filter((t) => !ship.has(t.toLowerCase()));
}

/** Normalised family key used to match grid classes against hardpoint port classes. */
export function familyKey(gridClass: string): string {
	return stripNoise(splitGridClass(gridClass).after).join(' ').toLowerCase();
}

/** "SecureHold" → ["Secure", "Hold"]; "F7C" and "Mk2" stay whole. */
export function splitCamel(token: string): string[] {
	const parts = token.split(/(?<=[a-z])(?=[A-Z])/);
	return parts.length > 1 ? parts : [token];
}

function words(tokens: readonly string[]): string[] {
	return tokens.flatMap(splitCamel);
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function isAcronym(word: string): boolean {
	return /^[A-Z0-9]{1,3}$/.test(word) || /\d/.test(word);
}

/** Sentence-case label: ["Nose", "Access"] → "Nose access"; ["KORE"] → "Kore"; ["MAX"] → "MAX". */
export function humanize(tokens: readonly string[]): string {
	const ws = words(tokens);
	return ws
		.map((w, i) => {
			if (isAcronym(w)) return w;
			if (i === 0) return capitalize(w);
			return /^[A-Z]+$/.test(w) ? capitalize(w).toLowerCase() : w.toLowerCase();
		})
		.join(' ');
}

/** Lower-case words joined by hyphens: ["Nose", "Access"] → "nose-access". */
export function kebab(tokens: readonly string[]): string {
	return words(tokens)
		.map((w) => w.toLowerCase())
		.join('-');
}

/** URL slug of a display name: "Grey's Shiv" → "greys-shiv", "C.O. Nomad" → "co-nomad". */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/['’.]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const MANUFACTURER_ALIASES: Readonly<Record<string, readonly string[]>> = {
	CNOU: ['C.O.'],
	MISC: ['MISC'],
	RSI: ['RSI']
};

/** Removes the manufacturer prefix from a published name: "Drake Cutlass Black" → "Cutlass Black". */
export function stripManufacturer(
	name: string,
	manufacturer: { code: string; name: string }
): string {
	const candidates = [
		manufacturer.name,
		manufacturer.name.split(' ')[0],
		manufacturer.code,
		...(MANUFACTURER_ALIASES[manufacturer.code] ?? [])
	]
		.filter((c) => c.length > 0)
		.sort((a, b) => b.length - a.length);
	const lower = name.toLowerCase();
	for (const candidate of candidates) {
		const prefix = candidate.toLowerCase() + ' ';
		if (lower.startsWith(prefix)) return name.slice(prefix.length).trim();
	}
	return name;
}

export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** ClassName tokens that mark an edition / skin / event variant rather than a different hull. */
const VARIANT_TOKEN =
	/^(pirate|boarded|teach|exec|executive|edition|collector|military|stealth|indust|industrial|stealthindustrial|civilian|showdown|bis\d*|citizencon\d*|tsg|fw|tier|temp|cos[a-z]|renegade|emerald)$/i;

/** Number of variant-marker tokens in a ClassName; 0 means "base hull". */
export function variantScore(className: string): number {
	return classTokens(className).filter((t) => VARIANT_TOKEN.test(t)).length;
}

/** Deterministic order: base hulls first, then shorter class names, then alphabetical. */
export function compareByBaseness(a: string, b: string): number {
	return variantScore(a) - variantScore(b) || a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

const SIZE_LABELS: Readonly<Record<number, string>> = {
	1: 'Extra small',
	2: 'Small',
	3: 'Medium',
	4: 'Large',
	5: 'Extra large',
	6: 'Capital'
};

/** The game's numeric vehicle size class (hangar/pad class) as a label. */
export function sizeLabel(size: number | undefined): string {
	if (size === undefined) return 'Unknown';
	return SIZE_LABELS[size] ?? String(size);
}
