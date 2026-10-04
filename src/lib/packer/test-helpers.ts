/**
 * Independent invariant checks and random item generators for packer tests.
 * Deliberately re-implemented (no Lattice reuse) so a bug in the packer's own
 * occupancy code cannot hide itself.
 */
import { CONTAINER_CELLS, CONTAINER_SIZES } from '../data/types.ts';
import type {
	CargoGrid,
	ContainerSize,
	PackGroup,
	PackItem,
	PackResult,
	Placement
} from '../data/types.ts';
import { createRng, type Rng } from './random.ts';

export function cellKey(x: number, y: number, z: number): string {
	return `${x},${y},${z}`;
}

function sortedDims(v: { x: number; y: number; z: number }): string {
	return [v.x, v.y, v.z].sort((a, b) => a - b).join('x');
}

export interface InvariantOptions {
	support?: number;
	allowRotation?: boolean;
}

/** Throws with a descriptive message on the first violated invariant. */
export function assertInvariants(
	grids: readonly CargoGrid[],
	items: readonly PackItem[],
	result: PackResult,
	options: InvariantOptions = {}
): void {
	const support = options.support ?? 1;
	const allowRotation = options.allowRotation ?? true;
	const gridById = new Map(grids.map((g) => [g.id, g]));
	const itemById = new Map(items.map((i) => [i.id, i]));

	// Σ placed + unplaced == items, each exactly once.
	const seen = new Set<string>();
	for (const p of result.placed) {
		if (seen.has(p.itemId)) throw new Error(`item ${p.itemId} placed twice`);
		seen.add(p.itemId);
	}
	for (const u of result.unplaced) {
		if (seen.has(u.item.id)) throw new Error(`item ${u.item.id} both placed and unplaced`);
		seen.add(u.item.id);
	}
	if (seen.size !== items.length) {
		throw new Error(`expected ${items.length} items accounted for, got ${seen.size}`);
	}
	for (const item of items) if (!seen.has(item.id)) throw new Error(`item ${item.id} missing`);

	// Loading order is a permutation 0..n-1 in array order.
	result.placed.forEach((p, i) => {
		if (p.order !== i) throw new Error(`placement ${i} has order ${p.order}`);
	});

	// Per grid: bounds, allowed sizes, shape, overlap, support.
	const occupied = new Map<string, Set<string>>();
	for (const g of grids) occupied.set(g.id, new Set());
	for (const p of result.placed) {
		const grid = gridById.get(p.gridId);
		const item = itemById.get(p.itemId);
		if (!grid) throw new Error(`unknown grid ${p.gridId}`);
		if (!item) throw new Error(`unknown item ${p.itemId}`);
		if (!grid.allowedSizes.includes(item.scu)) {
			throw new Error(`${item.scu} SCU not allowed in ${grid.id}`);
		}
		const canonical = CONTAINER_CELLS[item.scu];
		if (sortedDims(p.dims) !== sortedDims(canonical)) {
			throw new Error(`dims ${JSON.stringify(p.dims)} are not a ${item.scu} SCU shape`);
		}
		if (
			!allowRotation &&
			(p.dims.x !== canonical.x || p.dims.y !== canonical.y || p.dims.z !== canonical.z)
		) {
			throw new Error(`rotation used for ${p.itemId} although disabled`);
		}
		for (const axis of ['x', 'y', 'z'] as const) {
			if (
				!Number.isInteger(p.at[axis]) ||
				p.at[axis] < 0 ||
				p.at[axis] + p.dims[axis] > grid.cells[axis]
			) {
				throw new Error(`${p.itemId} out of bounds on ${axis} in ${grid.id}`);
			}
		}
		const occ = occupied.get(grid.id)!;
		for (let z = p.at.z; z < p.at.z + p.dims.z; z++)
			for (let y = p.at.y; y < p.at.y + p.dims.y; y++)
				for (let x = p.at.x; x < p.at.x + p.dims.x; x++) {
					const k = cellKey(x, y, z);
					if (occ.has(k)) throw new Error(`overlap at ${k} in ${grid.id} (${p.itemId})`);
					occ.add(k);
				}
	}
	for (const p of result.placed) {
		if (p.at.z === 0) continue;
		const occ = occupied.get(p.gridId)!;
		let supported = 0;
		for (let y = p.at.y; y < p.at.y + p.dims.y; y++)
			for (let x = p.at.x; x < p.at.x + p.dims.x; x++)
				if (occ.has(cellKey(x, y, p.at.z - 1))) supported++;
		const fraction = supported / (p.dims.x * p.dims.y);
		if (fraction + 1e-9 < support) {
			throw new Error(`${p.itemId} support ${fraction} < ${support}`);
		}
	}

	// Fills and totals.
	let used = 0;
	let capacity = 0;
	for (const g of grids) {
		const fill = result.fills.find((f) => f.gridId === g.id);
		if (!fill) throw new Error(`no fill for ${g.id}`);
		const total = g.cells.x * g.cells.y * g.cells.z;
		if (fill.totalCells !== total) throw new Error(`fill total for ${g.id}`);
		if (fill.usedCells !== occupied.get(g.id)!.size) throw new Error(`fill used for ${g.id}`);
		used += fill.usedCells;
		capacity += total;
	}
	if (result.fills.length !== grids.length) throw new Error('fills count');
	if (result.usedScu !== used) throw new Error(`usedScu ${result.usedScu} != ${used}`);
	if (result.capacityScu !== capacity) throw new Error('capacityScu');
	if (!(result.elapsedMs >= 0)) throw new Error('elapsedMs');

	// Reasons: static reasons are a function of the size alone.
	const bySize = new Map<ContainerSize, Set<string>>();
	for (const u of result.unplaced) {
		const set = bySize.get(u.item.scu) ?? new Set<string>();
		set.add(u.reason);
		bySize.set(u.item.scu, set);
	}
	for (const [scu, reasons] of bySize) {
		const allowing = grids.filter((g) => g.allowedSizes.includes(scu));
		const fits = allowing.some((g) => shapeFits(scu, g, allowRotation));
		const expected =
			allowing.length === 0 ? 'size-not-allowed' : fits ? 'no-space' : 'too-large-for-any-grid';
		if (reasons.size !== 1 || !reasons.has(expected)) {
			throw new Error(`reasons for ${scu} SCU: ${[...reasons].join(',')} expected ${expected}`);
		}
	}
}

export function shapeFits(scu: ContainerSize, grid: CargoGrid, allowRotation: boolean): boolean {
	const c = CONTAINER_CELLS[scu];
	const perms = allowRotation
		? [
				[c.x, c.y, c.z],
				[c.y, c.x, c.z],
				[c.x, c.z, c.y],
				[c.z, c.x, c.y],
				[c.y, c.z, c.x],
				[c.z, c.y, c.x]
			]
		: [[c.x, c.y, c.z]];
	return perms.some(([x, y, z]) => x <= grid.cells.x && y <= grid.cells.y && z <= grid.cells.z);
}

export function makeItems(
	scu: ContainerSize,
	count: number,
	group = 'g',
	prefix = group
): PackItem[] {
	return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${scu}-${i}`, scu, group }));
}

export function makeGroups(count: number): PackGroup[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `g${i}`,
		label: `Group ${i}`,
		colorIndex: i,
		unloadOrder: i
	}));
}

/** Random mixed item set; `sizes` defaults to every container size (including disallowed ones). */
export function randomItems(
	rng: Rng,
	count: number,
	groupCount = 1,
	sizes: readonly ContainerSize[] = CONTAINER_SIZES
): PackItem[] {
	const items: PackItem[] = [];
	for (let i = 0; i < count; i++) {
		const scu = sizes[Math.floor(rng() * sizes.length)];
		const g = Math.floor(rng() * groupCount);
		items.push({ id: `r${i}`, scu, group: `g${g}` });
	}
	return items;
}

export function seededRng(seed: number): Rng {
	return createRng(seed);
}

export function meanDepth(
	placements: readonly Placement[],
	depthOf: (p: Placement) => number
): number {
	if (placements.length === 0) return Number.NaN;
	return placements.reduce((s, p) => s + depthOf(p), 0) / placements.length;
}

/** Strips the timing field so results can be compared with toEqual. */
export function stable(result: PackResult): Omit<PackResult, 'elapsedMs'> {
	const { placed, unplaced, fills, usedScu, capacityScu } = result;
	return { placed, unplaced, fills, usedScu, capacityScu };
}
