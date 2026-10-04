/**
 * Raw scunpacked vehicle → Ship.
 *
 * Besides unit conversion this does three inferences the game data does not
 * spell out:
 *  - hardpoint ↔ grid matching (CargoGrids[] and Systems.CargoGrids.Ports[] are
 *    not in the same order; they are matched by class-name family and count),
 *  - stable grid ids and human names from the class-name suffix,
 *  - bays: grid families that share a root token (Module, Module_Walkway,
 *    Module_Ladder) and repeat the same number of times are one physical bay
 *    per repeat index (module-1 … module-4).
 */

import { allowedSizesFor, maxContainerOf } from '#lib/data/containers.ts';
import { CELL_M, type CargoGrid, type CellVec, type Ship, type Vec3 } from '#lib/data/types.ts';
import {
	classTokens,
	familyKey,
	humanize,
	kebab,
	normalizeWhitespace,
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

/* ---------- naming ---------- */

/**
 * Display tokens per distinct grid class. Stripping is relaxed level by level
 * until every class in the ship has a distinct label.
 */
export function displayTokensByClass(
	classes: readonly string[],
	shipClassName: string
): Map<string, string[]> {
	const levels: ((cls: string) => string[])[] = [
		(cls) => stripShipTokens(stripNoise(splitGridClass(cls).after), shipClassName),
		(cls) => stripNoise(splitGridClass(cls).after),
		(cls) => splitGridClass(cls).after,
		(cls) => {
			const { before, after } = splitGridClass(cls);
			return [...stripShipTokens(before, shipClassName), ...after];
		},
		(cls) => classTokens(cls)
	];
	for (const level of levels) {
		const map = new Map(classes.map((cls) => [cls, level(cls)] as const));
		const labels = [...map.values()].map((tokens) => kebab(tokens.length ? tokens : ['Main']));
		if (new Set(labels).size === labels.length) {
			return new Map([...map].map(([cls, tokens]) => [cls, tokens.length ? tokens : ['Main']]));
		}
	}
	throw new Error(`${shipClassName}: cannot derive distinct grid labels for ${classes.join(', ')}`);
}

interface BayPlan {
	root: string;
	/** True when every family sharing the root repeats equally and the repeat index is part of the bay. */
	indexed: boolean;
}

const BAY_ROOT_NOISE = /^(is|cargo|main)$/i;

/** Bay grouping per class: families sharing a root token form bays (see module doc). */
export function planBays(
	display: ReadonlyMap<string, readonly string[]>,
	counts: ReadonlyMap<string, number>
): Map<string, BayPlan> {
	const byRoot = groupBy([...display.keys()], (cls) => display.get(cls)![0].toLowerCase());
	const plan = new Map<string, BayPlan>();
	for (const [root, classes] of byRoot) {
		if (classes.length < 2 || BAY_ROOT_NOISE.test(root)) continue;
		const sizes = new Set(classes.map((cls) => counts.get(cls)));
		const n = counts.get(classes[0]) ?? 1;
		const indexed = sizes.size === 1 && n > 1;
		for (const cls of classes) plan.set(cls, { root: display.get(cls)![0], indexed });
	}
	return plan;
}

interface GridLabel {
	id: string;
	name: string;
	bay: string | null;
}

function labelGrid(
	tokens: readonly string[],
	index: number,
	count: number,
	bay: BayPlan | undefined
): GridLabel {
	const root = tokens[0];
	const rest = tokens.slice(1);
	const restName = rest.length ? ' ' + humanize(rest).toLowerCase() : '';
	const restId = rest.length ? '-' + kebab(rest) : '';
	if (bay?.indexed) {
		return {
			id: `${kebab([root])}-${index}${restId}`,
			name: `${humanize([root])} ${index}${restName}`,
			bay: `${kebab([root])}-${index}`
		};
	}
	const bayId = bay ? kebab([bay.root]) : null;
	if (count > 1)
		return { id: `${kebab(tokens)}-${index}`, name: `${humanize(tokens)} ${index}`, bay: bayId };
	return { id: kebab(tokens), name: humanize(tokens), bay: bayId };
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

	const classes = [...new Set(grids.map((g) => g.Class))];
	const counts = new Map(
		classes.map((cls) => [cls, grids.filter((g) => g.Class === cls).length] as const)
	);
	const display = displayTokensByClass(classes, className);
	const bays = planBays(display, counts);

	const seenPerClass = new Map<string, number>();
	const cargoGrids: CargoGrid[] = grids.map((g, i) => {
		const index = (seenPerClass.get(g.Class) ?? 0) + 1;
		seenPerClass.set(g.Class, index);
		const label = labelGrid(display.get(g.Class)!, index, counts.get(g.Class)!, bays.get(g.Class));

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

	const fullName = normalizeWhitespace(raw.Name);
	const ship: Ship = {
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
	return { ship, warnings };
}
