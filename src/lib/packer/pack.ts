/**
 * Lattice packer: First-Fit Decreasing over axis-aligned boxes in integer
 * cell lattices, with gravity (support), per-grid allowed sizes, door-aware
 * depth scoring, unload-order grouping and seeded randomised restarts.
 *
 * See README.md in this directory for the algorithm and the conventions.
 */
import { CONTAINER_CELLS } from '../data/types.ts';
import type {
	CargoGrid,
	CellVec,
	ContainerSize,
	DoorFace,
	GridFill,
	PackGroup,
	PackItem,
	PackOptions,
	PackResult,
	Placement,
	UnplacedItem
} from '../data/types.ts';
import {
	containerOrientations,
	depthFromDoor,
	doorOf,
	fitsWithin,
	isIntegerVec,
	scuOfDims,
	volumeOf
} from './geometry.ts';
import { Lattice } from './lattice.ts';
import { createRng, type Rng } from './random.ts';

export const DEFAULT_PACK_OPTIONS = {
	support: 1,
	allowRotation: true,
	restarts: 4,
	seed: 1
} as const;

/** Upper bound on restart passes, so a bad option cannot stall the worker. */
export const MAX_RESTARTS = 64;

export interface ResolvedPackOptions {
	support: number;
	allowRotation: boolean;
	gridOrder: readonly string[];
	locked: readonly Placement[];
	restarts: number;
	seed: number;
}

export function resolveOptions(options: PackOptions = {}): ResolvedPackOptions {
	const support = Number.isFinite(options.support)
		? Math.min(1, Math.max(0, options.support as number))
		: DEFAULT_PACK_OPTIONS.support;
	const restarts = Number.isFinite(options.restarts)
		? Math.min(MAX_RESTARTS, Math.max(0, Math.trunc(options.restarts as number)))
		: DEFAULT_PACK_OPTIONS.restarts;
	return {
		support,
		allowRotation: options.allowRotation ?? DEFAULT_PACK_OPTIONS.allowRotation,
		gridOrder: options.gridOrder ?? [],
		locked: options.locked ?? [],
		restarts,
		seed: Number.isFinite(options.seed) ? (options.seed as number) : DEFAULT_PACK_OPTIONS.seed
	};
}

/**
 * Grid visiting order: ids from `gridOrder` first (unknown ids ignored), then
 * the remaining grids by capacity in cells, largest first, stable on ties.
 */
export function orderGrids(grids: readonly CargoGrid[], gridOrder: readonly string[]): number[] {
	const byId = new Map<string, number>();
	grids.forEach((g, i) => byId.set(g.id, i));
	const head: number[] = [];
	for (const id of gridOrder) {
		const i = byId.get(id);
		if (i !== undefined && !head.includes(i)) head.push(i);
	}
	const rest = grids
		.map((_, i) => i)
		.filter((i) => !head.includes(i))
		.sort((a, b) => volumeOf(grids[b].cells) - volumeOf(grids[a].cells) || a - b);
	return [...head, ...rest];
}

/* ---------- internal context ---------- */

interface GridCtx {
	grid: CargoGrid;
	allowed: ReadonlySet<number>;
	door: DoorFace;
	/** Lattice with locked placements applied; cloned per pass. */
	base: Lattice;
}

interface Entry {
	item: PackItem;
	scu: ContainerSize;
	/** unloadOrder of the item's group; +Infinity for unknown groups (loaded first). */
	rank: number;
	index: number;
}

type StaticReason = Exclude<UnplacedItem['reason'], 'no-space'>;

interface PackContext {
	grids: GridCtx[];
	order: number[];
	entries: Entry[];
	locked: Placement[];
	/** Rank whose items are packed nearest the door; null when all items share one rank. */
	nearRank: number | null;
	staticReason: Map<ContainerSize, StaticReason>;
	options: ResolvedPackOptions;
}

type Strategy = 'layer' | 'column';

interface PassConfig {
	strategy: Strategy;
	/** Amplitude of the random noise added to the contact term; 0 = deterministic. */
	noise: number;
	rng: Rng | null;
}

interface PassResult {
	placed: Placement[];
	unplaced: UnplacedItem[];
	lattices: Lattice[];
	usedScu: number;
	maxHeight: number;
}

function cmp(a: number, b: number): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function isContainerSize(scu: number): scu is ContainerSize {
	return Object.hasOwn(CONTAINER_CELLS, scu);
}

function buildContext(
	grids: readonly CargoGrid[],
	items: readonly PackItem[],
	groups: readonly PackGroup[],
	options: ResolvedPackOptions
): PackContext {
	const gridCtx: GridCtx[] = grids.map((grid) => ({
		grid,
		allowed: new Set<number>(grid.allowedSizes),
		door: doorOf(grid),
		base: new Lattice(grid.cells)
	}));
	const gridIndex = new Map<string, number>();
	grids.forEach((g, i) => gridIndex.set(g.id, i));
	const itemById = new Map<string, PackItem>();
	for (const item of items) itemById.set(item.id, item);

	// Locked placements: applied first, never moved. A lock that cannot be
	// honoured (unknown grid/item, wrong shape, out of bounds, overlap) is
	// dropped and its item is packed normally.
	const locked: Placement[] = [];
	const lockedIds = new Set<string>();
	for (const p of options.locked) {
		const gi = gridIndex.get(p.gridId);
		const item = itemById.get(p.itemId);
		if (gi === undefined || !item || lockedIds.has(p.itemId)) continue;
		if (!isIntegerVec(p.at) || !isIntegerVec(p.dims)) continue;
		if (scuOfDims(p.dims) !== item.scu) continue;
		const lat = gridCtx[gi].base;
		if (!lat.inBounds(p.at, p.dims) || !lat.isFree(p.at, p.dims)) continue;
		lat.fill(p.at, p.dims, 1);
		lockedIds.add(p.itemId);
		locked.push({
			itemId: p.itemId,
			gridId: p.gridId,
			at: { ...p.at },
			dims: { ...p.dims },
			order: locked.length
		});
	}

	const rankOf = new Map<string, number>();
	for (const g of groups) rankOf.set(g.id, g.unloadOrder);

	const entries: Entry[] = [];
	items.forEach((item, index) => {
		if (lockedIds.has(item.id)) return;
		entries.push({
			item,
			scu: item.scu,
			rank: rankOf.get(item.group) ?? Number.POSITIVE_INFINITY,
			index
		});
	});
	// Loading order: groups unloaded last go in first (rank descending), then
	// biggest boxes first (FFD), then the caller's order.
	entries.sort((a, b) => cmp(b.rank, a.rank) || cmp(b.scu, a.scu) || cmp(a.index, b.index));

	const ranks = new Set(entries.map((e) => e.rank));
	const nearRank = ranks.size >= 2 ? Math.min(...ranks) : null;

	const staticReason = new Map<ContainerSize, StaticReason>();
	for (const e of entries) {
		if (staticReason.has(e.scu)) continue;
		const reason = staticReasonFor(gridCtx, e.scu, options.allowRotation);
		if (reason) staticReason.set(e.scu, reason);
	}

	return {
		grids: gridCtx,
		order: orderGrids(grids, options.gridOrder),
		entries,
		locked,
		nearRank,
		staticReason,
		options
	};
}

function staticReasonFor(
	grids: readonly GridCtx[],
	scu: ContainerSize,
	allowRotation: boolean
): StaticReason | null {
	if (!isContainerSize(scu)) return 'size-not-allowed';
	const allowing = grids.filter((g) => g.allowed.has(scu));
	if (allowing.length === 0) return 'size-not-allowed';
	const orientations = containerOrientations(scu, allowRotation);
	const fitsSomewhere = allowing.some((g) => orientations.some((o) => fitsWithin(o, g.grid.cells)));
	return fitsSomewhere ? null : 'too-large-for-any-grid';
}

/* ---------- one pass ---------- */

interface Best {
	gridIndex: number;
	at: CellVec;
	dims: CellVec;
}

/**
 * Best position for one item, first-fit over grids in visiting order. Within a
 * grid every resting, supported, free position of every permitted orientation
 * is scored lexicographically; see README §Scoring.
 */
function findBest(
	ctx: PackContext,
	cfg: PassConfig,
	lattices: readonly Lattice[],
	entry: Entry
): Best | null {
	const { scu } = entry;
	if (!isContainerSize(scu)) return null;
	const volume = scu; // one lattice cell is one SCU for every container shape
	const near = ctx.nearRank !== null && entry.rank === ctx.nearRank;
	const orientations = containerOrientations(scu, ctx.options.allowRotation);
	const at: CellVec = { x: 0, y: 0, z: 0 };

	for (const gi of ctx.order) {
		const g = ctx.grids[gi];
		if (!g.allowed.has(scu)) continue;
		const lat = lattices[gi];
		if (lat.free < volume) continue;
		const cells = g.grid.cells;

		let found = false;
		let b0 = 0;
		let b1 = 0;
		let b2 = 0;
		let b3 = 0;
		let bestAt: CellVec = { x: 0, y: 0, z: 0 };
		let bestDims: CellVec = orientations[0];

		for (let oi = 0; oi < orientations.length; oi++) {
			const dims = orientations[oi];
			if (!fitsWithin(dims, cells)) continue;
			const base = dims.x * dims.y;
			const minSupport = Math.ceil(ctx.options.support * base - 1e-9);
			const maxX = cells.x - dims.x;
			const maxY = cells.y - dims.y;
			const maxZ = cells.z - dims.z;

			for (let x = 0; x <= maxX; x++) {
				for (let y = 0; y <= maxY; y++) {
					for (let z = 0; z <= maxZ; z++) {
						at.x = x;
						at.y = y;
						at.z = z;
						const support = lat.supportCount(at, dims);
						if (support < minSupport) continue;
						if (!lat.isFree(at, dims)) continue;

						const depth = depthFromDoor(cells, g.door, at, dims);
						const depthKey = near ? depth : -depth;
						const contact = support + lat.sideContact(at, dims);
						const k0 = cfg.strategy === 'layer' ? z : depthKey;
						const k1 = cfg.strategy === 'layer' ? depthKey : z;
						const k2 = -contact + (cfg.rng && cfg.noise > 0 ? cfg.rng() * cfg.noise : 0);
						const k3 = cfg.rng ? cfg.rng() : (x * cells.y + y) * orientations.length + oi;

						if (
							!found ||
							k0 < b0 ||
							(k0 === b0 && (k1 < b1 || (k1 === b1 && (k2 < b2 || (k2 === b2 && k3 < b3)))))
						) {
							found = true;
							b0 = k0;
							b1 = k1;
							b2 = k2;
							b3 = k3;
							bestAt = { x, y, z };
							bestDims = dims;
						}
					}
				}
			}
		}
		if (found) return { gridIndex: gi, at: bestAt, dims: { ...bestDims } };
	}
	return null;
}

function runPass(ctx: PackContext, cfg: PassConfig): PassResult {
	const lattices = ctx.grids.map((g) => g.base.clone());
	const placed: Placement[] = ctx.locked.map((p) => ({
		...p,
		at: { ...p.at },
		dims: { ...p.dims }
	}));
	const unplaced: UnplacedItem[] = [];
	let usedScu = placed.reduce((sum, p) => sum + volumeOf(p.dims), 0);

	for (const entry of ctx.entries) {
		const best = findBest(ctx, cfg, lattices, entry);
		if (best) {
			lattices[best.gridIndex].fill(best.at, best.dims, 1);
			placed.push({
				itemId: entry.item.id,
				gridId: ctx.grids[best.gridIndex].grid.id,
				at: best.at,
				dims: best.dims,
				order: placed.length
			});
			usedScu += volumeOf(best.dims);
		} else {
			unplaced.push({ item: entry.item, reason: ctx.staticReason.get(entry.scu) ?? 'no-space' });
		}
	}

	let maxHeight = 0;
	for (const lat of lattices) maxHeight = Math.max(maxHeight, lat.maxHeight());
	return { placed, unplaced, lattices, usedScu, maxHeight };
}

/** Fewest unplaced, then most SCU placed, then lowest stack. */
function isBetterPass(a: PassResult, b: PassResult): boolean {
	if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
	if (a.usedScu !== b.usedScu) return a.usedScu > b.usedScu;
	return a.maxHeight < b.maxHeight;
}

const now: () => number =
	typeof performance !== 'undefined' && typeof performance.now === 'function'
		? () => performance.now()
		: () => Date.now();

/* ---------- public entry point ---------- */

/**
 * Packs `items` into `grids`. Pure and deterministic for a given seed.
 * Pass 0 is the canonical deterministic heuristic; `options.restarts` extra
 * passes alternate the layer/column strategy and add seeded noise to the
 * tiebreaks. The best pass wins (fewest unplaced, most SCU, lowest stack);
 * on ties the earlier pass is kept, so restarts never make a result worse.
 */
export function pack(
	grids: readonly CargoGrid[],
	items: readonly PackItem[],
	groups: readonly PackGroup[] = [],
	options: PackOptions = {}
): PackResult {
	const start = now();
	const resolved = resolveOptions(options);
	const ctx = buildContext(grids, items, groups, resolved);
	const rng = createRng(resolved.seed);

	let best = runPass(ctx, { strategy: 'layer', noise: 0, rng: null });
	const capacity = ctx.grids.reduce((sum, g) => sum + g.base.total, 0);
	const restarts = ctx.entries.length === 0 ? 0 : resolved.restarts;
	for (let p = 1; p <= restarts; p++) {
		// Nothing left to improve once everything sits on the floor or the hold is full.
		if (best.unplaced.length === 0 && (best.maxHeight <= 1 || best.usedScu === capacity)) break;
		const candidate = runPass(ctx, {
			strategy: p % 2 === 1 ? 'column' : 'layer',
			noise: 1 + p * 0.5,
			rng
		});
		if (isBetterPass(candidate, best)) best = candidate;
	}

	const fills: GridFill[] = ctx.grids.map((g, i) => ({
		gridId: g.grid.id,
		usedCells: best.lattices[i].used,
		totalCells: best.lattices[i].total
	}));

	return {
		placed: best.placed,
		unplaced: best.unplaced,
		fills,
		usedScu: best.usedScu,
		capacityScu: capacity,
		elapsedMs: now() - start
	};
}
