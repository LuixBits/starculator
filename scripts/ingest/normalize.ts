/**
 * Raw scunpacked vehicle → Ship.
 *
 * Besides unit conversion this does four inferences the game data does not
 * spell out:
 *  - hardpoint ↔ grid matching (CargoGrids[] and Systems.CargoGrids.Ports[] are
 *    not in the same order; they are matched by class-name family and count),
 *  - stable grid ids and human names from the class-name suffix,
 *  - position words for repeated grids of one class from their hardpoint names
 *    (hardpoint_cargogrid_bottom_front_left_lower → "Bottom front left lower");
 *    plain numbering (Main 1 … Main 4) is the fallback when hardpoints are
 *    missing or identical,
 *  - bays: grid families that share a root token (Module, Module_Walkway,
 *    Module_Ladder) and repeat the same number of times are one physical bay
 *    per repeat index (module-1 … module-4, or hold-left when the position
 *    words agree), and stacked grids (lower/upper) of one class share a bay.
 */

import { allowedSizesFor, maxContainerOf } from '#lib/data/containers.ts';
import { CELL_M, type CargoGrid, type CellVec, type Ship, type Vec3 } from '#lib/data/types.ts';
import {
	classTokens,
	familyKey,
	hasManufacturerPrefix,
	humanize,
	kebab,
	manufacturerPrefix,
	normalizeWhitespace,
	shipWords,
	sizeLabel,
	slugify,
	splitCamel,
	splitGridClass,
	stripManufacturer,
	stripNoise,
	stripShipTokens
} from './naming.ts';
import {
	rawGrids,
	rawPorts,
	type RawBox,
	type RawCargoGrid,
	type RawPort,
	type RawVehicle
} from './raw.ts';

const INTEGRAL_EPS = 1e-6;

/** Grids at least this large with a 1-SCU MaxSize are almost certainly a data defect (see research §12). */
const SUSPICIOUS_UNIT_LIMIT_SCU = 16;

export class IngestError extends Error {
	constructor(className: string, message: string) {
		super(`${className}: ${message}`);
		this.name = 'IngestError';
	}
}

export interface NormalizeResult {
	ship: Ship;
	/** Non-fatal data-quality observations, for the ingest log. */
	warnings: string[];
}

/* ---------- geometry ---------- */

function toCells(meters: number, what: string, className: string): number {
	const cells = meters / CELL_M;
	const rounded = Math.round(cells);
	if (Math.abs(cells - rounded) > INTEGRAL_EPS)
		throw new IngestError(className, `${what} = ${meters} m is not a multiple of ${CELL_M} m`);
	return rounded;
}

function toVec3(box: RawBox): Vec3 {
	return { x: box.X, y: box.Y, z: box.Z };
}

function toBox(box: RawBox | null | undefined): Vec3 | null {
	return box ? toVec3(box) : null;
}

function isUnitBox(box: Vec3 | null): boolean {
	return (
		box !== null &&
		Math.abs(box.x - CELL_M) < INTEGRAL_EPS &&
		Math.abs(box.y - CELL_M) < INTEGRAL_EPS &&
		Math.abs(box.z - CELL_M) < INTEGRAL_EPS
	);
}

/* ---------- hardpoint matching ---------- */

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	items.forEach((item) => {
		const k = key(item);
		const list = groups.get(k);
		if (list) list.push(item);
		else groups.set(k, [item]);
	});
	return groups;
}

function naturalCompare(a: string, b: string): number {
	return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function keyWords(key: string): Set<string> {
	return new Set(
		key
			.split(' ')
			.flatMap(splitCamel)
			.map((w) => w.toLowerCase())
	);
}

function shareWord(a: string, b: string): boolean {
	const wa = keyWords(a);
	for (const w of keyWords(b)) if (wa.has(w)) return true;
	return false;
}

/**
 * Hardpoint name per grid index (null when no port family could be matched).
 * Port families are matched to grid families by normalised class suffix and
 * equal count; leftovers are paired when the count or a shared word makes the
 * pairing unambiguous.
 */
export function matchHardpoints(
	grids: readonly RawCargoGrid[],
	ports: readonly RawPort[]
): (string | null)[] {
	const result: (string | null)[] = grids.map(() => null);
	const gridFamilies = [
		...groupBy(
			grids.map((g, i) => ({ g, i })),
			({ g }) => g.Class
		).entries()
	].map(([cls, members]) => ({ key: familyKey(cls), indices: members.map((m) => m.i) }));
	const portFamilies = [...groupBy(ports, (p) => p.ClassName).entries()].map(([cls, members]) => ({
		key: familyKey(cls),
		hardpoints: members.map((p) => p.HardpointName).sort(naturalCompare)
	}));

	const assign = (gf: (typeof gridFamilies)[number], pf: (typeof portFamilies)[number]): void => {
		gf.indices.forEach((gridIndex, k) => {
			result[gridIndex] = pf.hardpoints[k] ?? null;
		});
		gridFamilies.splice(gridFamilies.indexOf(gf), 1);
		portFamilies.splice(portFamilies.indexOf(pf), 1);
	};

	for (const gf of [...gridFamilies]) {
		const pf = portFamilies.find(
			(p) => p.key === gf.key && p.hardpoints.length === gf.indices.length
		);
		if (pf) assign(gf, pf);
	}

	let progress = true;
	while (progress && gridFamilies.length > 0 && portFamilies.length > 0) {
		progress = false;
		for (const gf of [...gridFamilies]) {
			const sameCount = portFamilies.filter((p) => p.hardpoints.length === gf.indices.length);
			const candidates =
				sameCount.length === 1 ? sameCount : sameCount.filter((p) => shareWord(p.key, gf.key));
			if (candidates.length === 1) {
				assign(gf, candidates[0]);
				progress = true;
			}
		}
	}
	return result;
}

/* ---------- naming: class tokens ---------- */

const MAIN: readonly string[] = ['Main'];

/** Display tokens, or the "Main" placeholder when the class carries none of its own. */
function orMain(tokens: readonly string[]): readonly string[] {
	return tokens.length ? tokens : MAIN;
}

/**
 * Display tokens per distinct grid class (empty when the class has no tokens of
 * its own). Stripping is relaxed level by level until every class in the ship
 * has a distinct label.
 */
export function displayTokensByClass(
	classes: readonly string[],
	ship: ReadonlySet<string>,
	shipClassName = 'ship'
): Map<string, string[]> {
	const levels: ((cls: string) => string[])[] = [
		(cls) => stripShipTokens(stripNoise(splitGridClass(cls).after), ship),
		(cls) => stripNoise(splitGridClass(cls).after),
		(cls) => splitGridClass(cls).after,
		(cls) => {
			const { before, after } = splitGridClass(cls);
			return [...stripShipTokens(before, ship), ...after];
		},
		(cls) => classTokens(cls)
	];
	for (const level of levels) {
		const map = new Map(classes.map((cls) => [cls, level(cls)] as const));
		const labels = [...map.values()].map((tokens) => kebab(orMain(tokens)));
		if (new Set(labels).size === labels.length) return new Map(map);
	}
	throw new Error(`${shipClassName}: cannot derive distinct grid labels for ${classes.join(', ')}`);
}

/* ---------- naming: position words from hardpoints ---------- */

const HARDPOINT_NOISE = /^(hardpoint|cargogrid|cargoinventory|cargo|grid|ic|temp|template)$/i;
const ABBREVIATIONS: Readonly<Record<string, string>> = { l: 'left', r: 'right' };

/** Lower-case descriptive words of a hardpoint name, without noise, numbers and ship words. */
export function hardpointWords(hardpoint: string, ship: ReadonlySet<string>): string[] {
	return classTokens(hardpoint)
		.map((t) => t.toLowerCase().replace(/\d+$/, ''))
		.map((t) => ABBREVIATIONS[t] ?? t)
		.filter((t) => t.length > 0 && !HARDPOINT_NOISE.test(t) && !ship.has(t));
}

interface CommonSplit {
	/** Per member, the words that are not shared by every member (one occurrence of each common word removed). */
	distinct: string[][];
	/** Words every member carries. */
	common: string[];
}

function dropCommonWords(lists: readonly string[][]): CommonSplit {
	const common = lists[0].filter((w) => lists.every((l) => l.includes(w)));
	const distinct = lists.map((list) => {
		const remaining = [...common];
		return list.filter((w) => {
			const at = remaining.indexOf(w);
			if (at < 0) return true;
			remaining.splice(at, 1);
			return false;
		});
	});
	return { distinct, common: [...new Set(common)] };
}

/** Repeated word lists get a running number so that every member stays distinct. */
function numberDuplicates(lists: readonly string[][]): string[][] {
	const total = new Map<string, number>();
	for (const l of lists) total.set(l.join(' '), (total.get(l.join(' ')) ?? 0) + 1);
	const seen = new Map<string, number>();
	return lists.map((l) => {
		const key = l.join(' ');
		if ((total.get(key) ?? 0) < 2) return l;
		const n = (seen.get(key) ?? 0) + 1;
		seen.set(key, n);
		return [...l, String(n)];
	});
}

export interface PositionWords {
	/** Per grid of the class, in grid order; every list is distinct. */
	words: string[][];
	/** Words shared by all hardpoints of the class (e.g. "large" on the Reclaimer's unnamed grids). */
	common: string[];
}

/**
 * Position words for the grids of one class, derived from their hardpoints,
 * or null when the class is not repeated, a hardpoint is missing or identical,
 * or the hardpoints differ only by number (Caterpillar module_01 … module_04).
 */
export function positionWords(
	hardpoints: readonly (string | null)[],
	ship: ReadonlySet<string>
): PositionWords | null {
	if (hardpoints.length < 2) return null;
	const named = hardpoints.filter((h): h is string => h !== null);
	if (named.length !== hardpoints.length || new Set(named).size !== named.length) return null;
	const { distinct, common } = dropCommonWords(named.map((h) => hardpointWords(h, ship)));
	if (distinct.every((w) => w.length === 0)) return null;
	return { words: numberDuplicates(distinct), common };
}

/* ---------- naming: bays ---------- */

interface BayPlan {
	root: string;
	/** True when every family sharing the root repeats equally and the repeat index is part of the bay. */
	indexed: boolean;
	/** Every class sharing the root, in display order. */
	classes: string[];
}

const BAY_ROOT_NOISE = /^(is|cargo|main)$/i;

/** Bay grouping per class: families sharing a root token form bays (see module doc). */
export function planBays(
	display: ReadonlyMap<string, readonly string[]>,
	counts: ReadonlyMap<string, number>
): Map<string, BayPlan> {
	const byRoot = groupBy([...display.keys()], (cls) => orMain(display.get(cls)!)[0].toLowerCase());
	const plan = new Map<string, BayPlan>();
	for (const [root, classes] of byRoot) {
		if (classes.length < 2 || BAY_ROOT_NOISE.test(root)) continue;
		const sizes = new Set(classes.map((cls) => counts.get(cls)));
		const n = counts.get(classes[0]) ?? 1;
		const indexed = sizes.size === 1 && n > 1;
		for (const cls of classes)
			plan.set(cls, { root: orMain(display.get(cls)!)[0], indexed, classes });
	}
	return plan;
}

/**
 * Bay id of the k-th repeat of an indexed bay: the position words all members
 * share when every class has them (hold-left), else the running number (module-1).
 */
function indexedBayId(
	plan: BayPlan,
	k: number,
	positions: ReadonlyMap<string, PositionWords>
): string {
	const root = kebab([plan.root]);
	const lists = plan.classes.map((cls) => positions.get(cls)?.words[k]);
	const first = lists[0];
	if (first === undefined || lists.some((l) => l === undefined)) return `${root}-${k + 1}`;
	const shared = first.filter((w) => lists.every((l) => l !== undefined && l.includes(w)));
	return shared.length ? `${root}-${shared.join('-')}` : `${root}-${k + 1}`;
}

const STACK_WORDS = new Set(['lower', 'upper', 'bottom', 'top']);

/**
 * Grids of one class whose position words end in a stacking word share a bay
 * named after the rest of the words (Hull B: bottom-front-left holds the lower
 * and the upper rack). Null when the words do not form such stacks.
 */
export function stackBays(
	tokens: readonly string[],
	words: readonly string[][]
): (string | null)[] {
	const stacked = words.every((w) => w.length >= 2 && STACK_WORDS.has(w[w.length - 1]));
	if (!stacked) return words.map(() => null);
	const bays = words.map((w) => kebab([...tokens, ...w.slice(0, -1)]));
	const members = new Map<string, number>();
	for (const b of bays) members.set(b, (members.get(b) ?? 0) + 1);
	if ([...members.values()].some((n) => n < 2)) return words.map(() => null);
	return bays;
}

/* ---------- naming: labels ---------- */

interface GridLabel {
	id: string;
	name: string;
	bay: string | null;
}

interface LabelContext {
	tokens: readonly string[];
	count: number;
	plan: BayPlan | undefined;
	position: PositionWords | undefined;
	positions: ReadonlyMap<string, PositionWords>;
}

/** Label of the `index`-th (1-based) grid of a class. */
function labelGrid(index: number, ctx: LabelContext): GridLabel {
	const { tokens, count, plan, position } = ctx;
	const k = index - 1;
	if (position) {
		const words = position.words[k];
		const all = [...tokens, ...words];
		const bay = plan
			? plan.indexed
				? indexedBayId(plan, k, ctx.positions)
				: kebab([plan.root])
			: stackBays(tokens, position.words)[k];
		return { id: kebab(all), name: humanize(all), bay };
	}
	const named = orMain(tokens);
	const root = named[0];
	const rest = named.slice(1);
	const restName = rest.length ? ' ' + humanize(rest).toLowerCase() : '';
	const restId = rest.length ? '-' + kebab(rest) : '';
	if (plan?.indexed) {
		return {
			id: `${kebab([root])}-${index}${restId}`,
			name: `${humanize([root])} ${index}${restName}`,
			bay: indexedBayId(plan, k, ctx.positions)
		};
	}
	const bayId = plan ? kebab([plan.root]) : null;
	if (count > 1)
		return { id: `${kebab(named)}-${index}`, name: `${humanize(named)} ${index}`, bay: bayId };
	return { id: kebab(named), name: humanize(named), bay: bayId };
}

/**
 * A class without tokens of its own takes the words all its hardpoints share
 * (Reclaimer: hardpoint_cargogrid_large_* → "Large"), unless that collides with
 * another class's label.
 */
function promoteCommonWords(
	display: Map<string, string[]>,
	positions: ReadonlyMap<string, PositionWords>
): void {
	const labels = new Set([...display.values()].map((t) => kebab(orMain(t))));
	for (const [cls, tokens] of display) {
		const common = positions.get(cls)?.common ?? [];
		if (tokens.length > 0 || common.length === 0) continue;
		const promoted = common.map((w) => humanize([w]));
		if (labels.has(kebab(promoted))) continue;
		labels.delete('main');
		labels.add(kebab(promoted));
		display.set(cls, promoted);
	}
}

/* ---------- the normaliser ---------- */

export function normalizeVehicle(raw: RawVehicle): NormalizeResult {
	const className = raw.ClassName;
	const warnings: string[] = [];
	const code = raw.Manufacturer?.Code;
	const manufacturerName = raw.Manufacturer?.Name;
	if (!code || !manufacturerName)
		throw new IngestError(className, 'missing Manufacturer.Code/Name');
	const manufacturer = { code, name: manufacturerName };

	const grids = rawGrids(raw);
	if (grids.length === 0) throw new IngestError(className, 'has no cargo grids');
	const hardpoints = matchHardpoints(grids, rawPorts(raw));

	const ship = shipWords(className, raw.Name);
	const classes = [...new Set(grids.map((g) => g.Class))];
	const membersByClass = new Map(
		classes.map((cls) => [cls, grids.flatMap((g, i) => (g.Class === cls ? [i] : []))] as const)
	);
	const counts = new Map([...membersByClass].map(([cls, m]) => [cls, m.length] as const));
	const display = displayTokensByClass(classes, ship, className);
	const positions = new Map<string, PositionWords>();
	for (const [cls, members] of membersByClass) {
		const position = positionWords(
			members.map((i) => hardpoints[i]),
			ship
		);
		if (position) positions.set(cls, position);
	}
	promoteCommonWords(display, positions);
	const bays = planBays(display, counts);

	const seenPerClass = new Map<string, number>();
	const cargoGrids: CargoGrid[] = grids.map((g, i) => {
		const index = (seenPerClass.get(g.Class) ?? 0) + 1;
		seenPerClass.set(g.Class, index);
		const label = labelGrid(index, {
			tokens: display.get(g.Class)!,
			count: counts.get(g.Class)!,
			plan: bays.get(g.Class),
			position: positions.get(g.Class),
			positions
		});

		const cells: CellVec = {
			x: toCells(g.X, `${g.Class} X`, className),
			y: toCells(g.Y, `${g.Class} Y`, className),
			z: toCells(g.Z, `${g.Class} Z`, className)
		};
		if (cells.x * cells.y * cells.z !== g.SCU)
			warnings.push(
				`${className}/${g.Class}: SCU ${g.SCU} ≠ ${cells.x}×${cells.y}×${cells.z} cells`
			);
		const minBox = toBox(g.MinSize);
		const maxBox = toBox(g.MaxSize);
		if (!maxBox)
			warnings.push(`${className}/${g.Class}: MaxSize missing, allowing every size that fits`);
		else if (isUnitBox(maxBox) && g.SCU >= SUSPICIOUS_UNIT_LIMIT_SCU)
			warnings.push(
				`${className}/${g.Class}: MaxSize is 1 SCU on a ${g.SCU} SCU grid (likely a data defect; consider an override)`
			);
		const allowedSizes = allowedSizesFor(cells, minBox, maxBox);
		if (allowedSizes.length === 0) warnings.push(`${className}/${g.Class}: no container size fits`);
		if (hardpoints[i] === null) warnings.push(`${className}/${g.Class}: no hardpoint matched`);

		return {
			id: label.id,
			name: label.name,
			className: g.Class,
			cells,
			meters: { x: g.X, y: g.Y, z: g.Z },
			scu: g.SCU,
			minBox,
			maxBox,
			allowedSizes,
			external: g.IsExternalContainer === true,
			hardpoint: hardpoints[i],
			bay: label.bay,
			offset: null,
			door: null
		};
	});

	const ids = new Set(cargoGrids.map((g) => g.id));
	if (ids.size !== cargoGrids.length)
		throw new IngestError(
			className,
			`duplicate grid ids: ${cargoGrids.map((g) => g.id).join(', ')}`
		);

	const cargoScu = raw.Cargo ?? 0;
	const gridSum = cargoGrids.reduce((sum, g) => sum + g.scu, 0);
	if (Math.abs(gridSum - cargoScu) > INTEGRAL_EPS)
		throw new IngestError(className, `grid SCU sum ${gridSum} ≠ Cargo ${cargoScu}`);

	// The PYAM Exec editions are published without "Drake"/"Gatac"; give them the prefix their siblings carry.
	const publishedName = normalizeWhitespace(raw.Name);
	const fullName = hasManufacturerPrefix(publishedName, manufacturer)
		? publishedName
		: `${manufacturerPrefix(manufacturer)} ${publishedName}`;
	const result: Ship = {
		slug: slugify(fullName),
		name: stripManufacturer(fullName, manufacturer),
		fullName,
		className,
		uuid: raw.UUID,
		manufacturer,
		size: sizeLabel(raw.Size),
		role: raw.Role || null,
		career: raw.Career || null,
		dimensions: { x: raw.Width, y: raw.Length, z: raw.Height },
		cargoScu,
		grids: cargoGrids,
		maxContainer: maxContainerOf(cargoGrids.flatMap((g) => g.allowedSizes)),
		isSpaceship: raw.IsSpaceship === true,
		isGroundVehicle: raw.IsVehicle === true || raw.IsGravlev === true,
		variantOf: null,
		variants: []
	};
	return { ship: result, warnings };
}
