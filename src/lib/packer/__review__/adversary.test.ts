/**
 * Adversarial property tests for the lattice packer against the real
 * generated ship data (review round 1). Everything is seeded and
 * deterministic; every failure message carries the seed, the options and the
 * item set so a violated invariant can be reproduced with one call.
 *
 * Invariants checked on every result: no overlaps, in bounds, support,
 * allowedSizes, placed + unplaced == input (each item once, unplaced items
 * returned intact), fills consistent with placements, loading order (locks
 * first, then rank descending, FFD within a rank, caller order last),
 * agreement with validatePlan, end-state feasibility of unplaced items,
 * determinism and input immutability.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CONTAINER_CELLS,
	CONTAINER_SIZES,
	type CargoGrid,
	type CellVec,
	type ContainerSize,
	type PackGroup,
	type PackItem,
	type PackOptions,
	type PackResult,
	type Placement,
	type Ship
} from '../../data/types.ts';
import { createPackerClient } from '../client.ts';
import { containerOrientations, depthFromDoor, doorOf } from '../geometry.ts';
import { expandCounts, gridCapacityByContainer, validatePlan } from '../helpers.ts';
import { pack } from '../pack.ts';
import { handlePackRequest, type PackRequest, type PackResponse } from '../protocol.ts';
import { createRng, shuffle } from '../random.ts';
import { assertInvariants, makeGroups, makeItems, stable } from '../test-helpers.ts';

/* ---------- real ship data ---------- */

const shipFiles = import.meta.glob<{ default: Ship }>('../../data/generated/ships/*.json', {
	eager: true
});
const ships: Ship[] = Object.values(shipFiles).map((m) => m.default);

function ship(slug: string): Ship {
	const found = ships.find((s) => s.slug === slug);
	if (!found) throw new Error(`${slug} missing from generated data`);
	return found;
}

const caterpillar = ship('drake-caterpillar');
const hullC = ship('misc-hull-c');
const c2 = ship('crusader-c2-hercules-starlifter');
const zeusCl = ship('rsi-zeus-mk-ii-cl');
const titan = ship('aegis-avenger-titan');
const idrisP = ship('aegis-idris-p');
const focus = [caterpillar, hullC, c2, zeusCl, titan];

/* ---------- helpers ---------- */

interface Case {
	seed: number;
	items: PackItem[];
	groups: PackGroup[];
	options: PackOptions;
}

/** Random mixed load with 1–4 known groups, a few stray-group items and random options. */
function randomCase(seed: number, target: Ship): Case {
	const rng = createRng(seed);
	const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
	const groupCount = 1 + Math.floor(rng() * 4);
	const groups = makeGroups(groupCount);
	const count = 5 + Math.floor(rng() * 120);
	const items: PackItem[] = [];
	for (let i = 0; i < count; i++) {
		const group = rng() < 0.05 ? 'stray' : `g${Math.floor(rng() * groupCount)}`;
		items.push({ id: `s${seed}-i${i}`, scu: pick(CONTAINER_SIZES), group, label: `box ${i}` });
	}
	const options: PackOptions = {
		support: pick([1, 1, 0.75, 0.5, 0.25, 0]),
		allowRotation: rng() < 0.7,
		restarts: pick([0, 1, 2, 4, 7]),
		seed: Math.floor(rng() * 1e6)
	};
	if (rng() < 0.5) {
		const ids = shuffle(
			target.grids.map((g) => g.id),
			rng
		);
		options.gridOrder = [...ids.slice(0, 2), 'no-such-grid', ...ids.slice(0, 1)];
	}
	return { seed, items, groups, options };
}

function repro(target: Ship, c: Case): string {
	return `ship=${target.slug} seed=${c.seed} options=${JSON.stringify(c.options)} items=${JSON.stringify(
		c.items.map((i) => `${i.scu}@${i.group}`)
	)}`;
}

function volume(v: CellVec): number {
	return v.x * v.y * v.z;
}

/**
 * Loading order: honoured locks first (in lock order), then rank descending
 * (group unloaded last goes in first), biggest SCU first within a rank, then
 * caller order. Unknown groups rank +Infinity.
 */
function checkLoadingOrder(
	items: readonly PackItem[],
	groups: readonly PackGroup[],
	result: PackResult,
	lockedIds: readonly string[],
	message: string
): void {
	const rank = new Map(groups.map((g) => [g.id, g.unloadOrder]));
	const index = new Map(items.map((it, i) => [it.id, i]));
	const byId = new Map(items.map((it) => [it.id, it]));
	expect(
		result.placed.slice(0, lockedIds.length).map((p) => p.itemId),
		`${message}: locks first`
	).toEqual(lockedIds);
	const free = result.placed.slice(lockedIds.length);
	for (let i = 1; i < free.length; i++) {
		const a = byId.get(free[i - 1].itemId);
		const b = byId.get(free[i].itemId);
		if (!a || !b) throw new Error(`${message}: unknown item in placed`);
		const ra = rank.get(a.group) ?? Number.POSITIVE_INFINITY;
		const rb = rank.get(b.group) ?? Number.POSITIVE_INFINITY;
		const ok =
			ra > rb ||
			(ra === rb && (a.scu > b.scu || (a.scu === b.scu && index.get(a.id)! < index.get(b.id)!)));
		expect(ok, `${message}: loading order broken between ${a.id} and ${b.id}`).toBe(true);
	}
}

/** Unplaced items must come back intact (same object content as the input). */
function checkUnplacedIntact(
	items: readonly PackItem[],
	result: PackResult,
	message: string
): void {
	const byId = new Map(items.map((it) => [it.id, it]));
	for (const u of result.unplaced) {
		expect(u.item, `${message}: unplaced item ${u.item.id} altered`).toEqual(byId.get(u.item.id));
	}
}

type Occupancy = Map<string, Set<string>>;

function occupancyOf(grids: readonly CargoGrid[], result: PackResult): Occupancy {
	const occ: Occupancy = new Map();
	for (const g of grids) occ.set(g.id, new Set());
	for (const p of result.placed) {
		const set = occ.get(p.gridId)!;
		for (let z = p.at.z; z < p.at.z + p.dims.z; z++)
			for (let y = p.at.y; y < p.at.y + p.dims.y; y++)
				for (let x = p.at.x; x < p.at.x + p.dims.x; x++) set.add(`${x},${y},${z}`);
	}
	return occ;
}

/**
 * Sound end-state checks for 'no-space' items. Free cells only ever decrease
 * during a pass, so a free floor footprint (always supported) in an allowing
 * grid at the end means the item was placeable when it was processed. For a
 * 1-SCU box any free cell that is on the floor or above an occupied cell is a
 * witness (the lowest free cell of that column was free and supported at the
 * time, too).
 */
function checkEndStateFeasibility(
	grids: readonly CargoGrid[],
	result: PackResult,
	allowRotation: boolean,
	message: string
): void {
	const occ = occupancyOf(grids, result);
	for (const u of result.unplaced) {
		if (u.reason !== 'no-space') continue;
		const scu = u.item.scu;
		for (const g of grids) {
			if (!g.allowedSizes.includes(scu)) continue;
			const set = occ.get(g.id)!;
			for (const dims of containerOrientations(scu, allowRotation)) {
				if (dims.x > g.cells.x || dims.y > g.cells.y || dims.z > g.cells.z) continue;
				for (let x = 0; x + dims.x <= g.cells.x; x++)
					for (let y = 0; y + dims.y <= g.cells.y; y++) {
						let free = true;
						for (let z = 0; z < dims.z && free; z++)
							for (let yy = y; yy < y + dims.y && free; yy++)
								for (let xx = x; xx < x + dims.x && free; xx++)
									if (set.has(`${xx},${yy},${z}`)) free = false;
						expect(
							free,
							`${message}: ${u.item.id} (${scu} SCU) reported no-space but ${g.id} has a free floor footprint at ${x},${y},0 for ${dims.x}×${dims.y}×${dims.z}`
						).toBe(false);
					}
			}
			if (scu === 1) {
				for (let x = 0; x < g.cells.x; x++)
					for (let y = 0; y < g.cells.y; y++)
						for (let z = 0; z < g.cells.z; z++) {
							const feasible =
								!set.has(`${x},${y},${z}`) && (z === 0 || set.has(`${x},${y},${z - 1}`));
							expect(
								feasible,
								`${message}: 1-SCU ${u.item.id} reported no-space but ${g.id} has a free supported cell at ${x},${y},${z}`
							).toBe(false);
						}
			}
		}
	}
}

function deepFreeze<T>(value: T): T {
	if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
	}
	return value;
}

/** Everything the suite asserts about one pack() call on one case. */
function checkCase(target: Ship, c: Case): PackResult {
	const message = repro(target, c);
	const grids = structuredClone(target.grids);
	const items = structuredClone(c.items);
	const groups = structuredClone(c.groups);
	const options = structuredClone(c.options);
	const r = pack(grids, items, groups, options);
	const support = options.support ?? 1;
	const allowRotation = options.allowRotation ?? true;

	expect(
		() => assertInvariants(grids, items, r, { support, allowRotation }),
		message
	).not.toThrow();
	expect([...validatePlan(grids, r.placed, { support, allowRotation }).keys()], message).toEqual(
		[]
	);
	checkLoadingOrder(items, groups, r, [], message);
	checkUnplacedIntact(items, r, message);
	checkEndStateFeasibility(grids, r, allowRotation, message);
	expect(Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0, `${message}: elapsedMs`).toBe(true);

	// Inputs untouched, result structured-clone safe (it crosses the worker boundary).
	expect(grids, `${message}: grids mutated`).toEqual(target.grids);
	expect(items, `${message}: items mutated`).toEqual(c.items);
	expect(groups, `${message}: groups mutated`).toEqual(c.groups);
	expect(options, `${message}: options mutated`).toEqual(c.options);
	expect(structuredClone(r), `${message}: result not clone-stable`).toEqual(r);

	// Deterministic, also for frozen inputs (a mutation would throw in strict mode).
	const again = pack(
		deepFreeze(structuredClone(target.grids)),
		deepFreeze(structuredClone(c.items)),
		deepFreeze(structuredClone(c.groups)),
		deepFreeze(structuredClone(c.options))
	);
	expect(stable(again), `${message}: not deterministic`).toEqual(stable(r));
	return r;
}

/* ---------- random loads ---------- */

describe('seeded random loads on real ships', () => {
	it.each(focus.map((s) => [s.slug, s] as const))(
		'%s: all invariants hold over 24 seeds',
		(_slug, target) => {
			for (let seed = 1; seed <= 24; seed++) checkCase(target, randomCase(seed * 7919, target));
		}
	);

	it('every ship survives three random loads', () => {
		for (const target of ships) {
			for (let seed = 1; seed <= 3; seed++) {
				checkCase(target, randomCase(seed * 104729 + target.grids.length, target));
			}
		}
	});

	it('restarts never do worse than the deterministic pass, which ignores the seed', () => {
		for (const target of focus) {
			for (let seed = 31; seed <= 42; seed++) {
				const c = randomCase(seed, target);
				const base = { ...c.options, restarts: 0 };
				const single = pack(target.grids, c.items, c.groups, { ...base, seed: 1 });
				const otherSeed = pack(target.grids, c.items, c.groups, { ...base, seed: 987654 });
				expect(stable(otherSeed), repro(target, c)).toEqual(stable(single));
				const multi = pack(target.grids, c.items, c.groups, { ...c.options, restarts: 6 });
				expect(multi.unplaced.length, repro(target, c)).toBeLessThanOrEqual(single.unplaced.length);
				if (multi.unplaced.length === single.unplaced.length) {
					expect(multi.usedScu, repro(target, c)).toBeGreaterThanOrEqual(single.usedScu);
				}
			}
		}
	});
});

/* ---------- unload order ---------- */

describe('unload-order semantics on real ships', () => {
	it('the group unloaded first is loaded last and sits nearer the door, for every door face', () => {
		const groups = makeGroups(3);
		for (const target of [c2, zeusCl, caterpillar]) {
			const grid = target.grids[0];
			for (const door of [null, '+y', '-x', '+x'] as const) {
				const grids = [{ ...grid, door }];
				const sizes = grid.allowedSizes.filter((s) => s <= 4);
				for (const scu of sizes) {
					// Three groups on at most three quarters of the floor: the depth
					// claim only applies while groups share a layer (the layer-first
					// strategy stratifies by height once a group fills a whole layer).
					const footprint = CONTAINER_CELLS[scu].x * CONTAINER_CELLS[scu].y;
					const perGroup = Math.max(2, Math.floor((grid.cells.x * grid.cells.y) / footprint / 4));
					const items = [
						...makeItems(scu, perGroup, 'g0'),
						...makeItems(scu, perGroup, 'g1'),
						...makeItems(scu, perGroup, 'g2')
					];
					const message = `${target.slug} door=${door} scu=${scu} n=${perGroup}`;
					const r = pack(grids, items, groups);
					expect(() => assertInvariants(grids, items, r), message).not.toThrow();
					checkLoadingOrder(items, groups, r, [], message);
					const depth = (p: Placement) => depthFromDoor(grid.cells, doorOf(grids[0]), p.at, p.dims);
					const mean = (g: string) => {
						const ps = r.placed.filter((p) => p.itemId.startsWith(g));
						return ps.reduce((s, p) => s + depth(p), 0) / ps.length;
					};
					expect(mean('g0'), message).toBeLessThan(mean('g2'));
					expect(mean('g0'), message).toBeLessThanOrEqual(mean('g1'));
				}
			}
		}
	});

	it('items of unknown groups are loaded first and never break the order of known groups', () => {
		const groups = makeGroups(2);
		const items: PackItem[] = [
			{ id: 'a', scu: 1, group: 'g0' },
			{ id: 'b', scu: 8, group: 'g1' },
			{ id: 'c', scu: 2, group: 'ghost' },
			{ id: 'd', scu: 16, group: 'g0' },
			{ id: 'e', scu: 1, group: 'g1' },
			{ id: 'f', scu: 2, group: 'g0' }
		];
		const r = pack(c2.grids, items, groups);
		expect(r.placed.map((p) => p.itemId)).toEqual(['c', 'b', 'e', 'd', 'f', 'a']);
		checkLoadingOrder(items, groups, r, [], 'unknown group');
	});
});

/* ---------- locks ---------- */

describe('locked placements on real ships', () => {
	it('re-locking every placement of a result reproduces it exactly', () => {
		for (const target of focus) {
			for (let seed = 51; seed <= 56; seed++) {
				const c = randomCase(seed, target);
				const first = pack(target.grids, c.items, c.groups, c.options);
				const locked = first.placed.map((p) => ({ ...p, order: 999 }));
				const second = pack(target.grids, c.items, c.groups, { ...c.options, locked });
				const message = repro(target, c);
				expect(() =>
					assertInvariants(target.grids, c.items, second, {
						support: c.options.support,
						allowRotation: c.options.allowRotation
					})
				).not.toThrow();
				expect(second.placed.slice(0, first.placed.length), message).toEqual(first.placed);
				expect(second.placed.length, message).toBeGreaterThanOrEqual(first.placed.length);
				checkLoadingOrder(
					c.items,
					c.groups,
					second,
					first.placed.map((p) => p.itemId),
					message
				);
			}
		}
	});

	it('keeps a random floor subset locked and packs the rest around it', () => {
		for (const target of focus) {
			for (let seed = 61; seed <= 66; seed++) {
				const c = randomCase(seed, target);
				const first = pack(target.grids, c.items, c.groups, c.options);
				const rng = createRng(seed);
				const locked = shuffle(
					first.placed.filter((p) => p.at.z === 0 && rng() < 0.5),
					rng
				);
				const r = pack(target.grids, c.items, c.groups, { ...c.options, locked });
				const message = `${repro(target, c)} locked=${JSON.stringify(locked.map((p) => p.itemId))}`;
				expect(() =>
					assertInvariants(target.grids, c.items, r, {
						support: c.options.support,
						allowRotation: c.options.allowRotation
					})
				).not.toThrow();
				for (const [i, lock] of locked.entries()) {
					expect(r.placed[i], message).toEqual({ ...lock, order: i });
				}
				checkLoadingOrder(
					c.items,
					c.groups,
					r,
					locked.map((p) => p.itemId),
					message
				);
				expect(
					[
						...validatePlan(target.grids, r.placed, {
							support: c.options.support,
							allowRotation: c.options.allowRotation
						}).keys()
					],
					message
				).toEqual([]);
			}
		}
	});

	it('drops garbage locks and still accounts for every item exactly once', () => {
		const items = [...expandCounts({ 8: 4, 4: 3, 1: 5 }, 'a'), ...expandCounts({ 16: 2 }, 'b')];
		const rng = createRng(77);
		const garbage: Placement[] = [];
		for (let i = 0; i < 40; i++) {
			const item = items[Math.floor(rng() * items.length)];
			const grid = zeusCl.grids[Math.floor(rng() * zeusCl.grids.length)];
			const d = CONTAINER_CELLS[item.scu];
			garbage.push({
				itemId: rng() < 0.1 ? `ghost-${i}` : item.id,
				gridId: rng() < 0.1 ? 'nope' : grid.id,
				at: {
					x: Math.floor(rng() * 8) - 2,
					y: Math.floor(rng() * 10) - 2,
					z: rng() < 0.2 ? 0.5 : Math.floor(rng() * 4) - 1
				},
				dims: rng() < 0.2 ? { x: d.x + 1, y: d.y, z: d.z } : { ...d },
				order: i
			});
		}
		const r = pack(zeusCl.grids, items, makeGroups(2), { locked: garbage });
		// Locks are not checked against allowedSizes or support (documented), so
		// only the accounting invariants are asserted here.
		const seen = [...r.placed.map((p) => p.itemId), ...r.unplaced.map((u) => u.item.id)].sort();
		expect(seen).toEqual(items.map((i) => i.id).sort());
		r.placed.forEach((p, i) => expect(p.order).toBe(i));
		for (const p of r.placed) {
			const grid = zeusCl.grids.find((g) => g.id === p.gridId)!;
			expect(grid, p.itemId).toBeDefined();
			for (const axis of ['x', 'y', 'z'] as const) {
				expect(Number.isInteger(p.at[axis]), p.itemId).toBe(true);
				expect(p.at[axis], p.itemId).toBeGreaterThanOrEqual(0);
				expect(p.at[axis] + p.dims[axis], p.itemId).toBeLessThanOrEqual(grid.cells[axis]);
			}
		}
		const occ = occupancyOf(zeusCl.grids, r);
		const cells = [...occ.values()].reduce((s, set) => s + set.size, 0);
		expect(cells).toBe(r.placed.reduce((s, p) => s + volume(p.dims), 0));
		expect(r.usedScu).toBe(cells);
	});

	it('Hull C stays perfect with a third of a perfect pack locked (floating locks included)', () => {
		const items = makeItems(32, 144);
		const full = pack(hullC.grids, items, [], { restarts: 0 });
		expect(full.unplaced).toEqual([]);
		const rng = createRng(9);
		const locked = full.placed.filter(() => rng() < 0.33);
		const r = pack(hullC.grids, items, [], { locked });
		expect(r.unplaced).toEqual([]);
		expect(r.usedScu).toBe(4608);
		expect(r.placed.slice(0, locked.length).map((p) => p.itemId)).toEqual(
			locked.map((p) => p.itemId)
		);
	});
});

/* ---------- sanity on the real data ---------- */

describe('sanity on real ships', () => {
	it('Hull C takes exactly 144 × 32 SCU, a 145th is no-space, every other size is size-not-allowed', () => {
		const items = makeItems(32, 144);
		const r = pack(hullC.grids, items);
		expect(() => assertInvariants(hullC.grids, items, r)).not.toThrow();
		expect(r.unplaced).toEqual([]);
		expect(r.usedScu).toBe(4608);
		expect(r.capacityScu).toBe(hullC.cargoScu);
		for (const f of r.fills) expect(f.usedCells).toBe(f.totalCells);

		const more = [...items, ...makeItems(32, 1, 'g', 'extra')];
		const r2 = pack(hullC.grids, more);
		expect(r2.unplaced.map((u) => [u.item.scu, u.reason])).toEqual([[32, 'no-space']]);

		for (const scu of [1, 2, 4, 8, 16, 24] as const) {
			const r3 = pack(hullC.grids, makeItems(scu, 1));
			expect(r3.placed, `${scu} SCU`).toEqual([]);
			expect(
				r3.unplaced.map((u) => u.reason),
				`${scu} SCU`
			).toEqual(['size-not-allowed']);
		}
		const cap = gridCapacityByContainer(hullC.grids[0]);
		expect(cap[32]).toBe(12);
		expect(cap[16]).toBe(0);
		expect(gridCapacityByContainer(hullC.grids[8])[32]).toBe(6);
	});

	it('Caterpillar: four 24-SCU boxes per module, 32 SCU rejected, modules do not leak into walkways', () => {
		const modules = caterpillar.grids.filter((g) => g.className.endsWith('_Module'));
		expect(modules).toHaveLength(4);
		const items = makeItems(24, 16);
		const r = pack(caterpillar.grids, items);
		expect(() => assertInvariants(caterpillar.grids, items, r)).not.toThrow();
		expect(r.unplaced).toEqual([]);
		expect(new Set(r.placed.map((p) => p.gridId))).toEqual(new Set(modules.map((m) => m.id)));
		expect(pack(caterpillar.grids, makeItems(24, 17)).unplaced.map((u) => u.reason)).toEqual([
			'no-space'
		]);
		expect(pack(caterpillar.grids, makeItems(32, 1)).unplaced.map((u) => u.reason)).toEqual([
			'size-not-allowed'
		]);
		const cap = gridCapacityByContainer(modules[0]);
		expect(cap[24]).toBe(4);
		expect(cap[16]).toBe(6);
		expect(cap[32]).toBe(0);
	});

	it('Zeus CL: two 32-SCU boxes lie along the main hold, the side pockets take one rotated 4-SCU each', () => {
		const items = [...makeItems(32, 3), ...makeItems(4, 2, 'g', 'side')];
		const r = pack(zeusCl.grids, items, [], { gridOrder: ['left', 'right'] });
		expect(() => assertInvariants(zeusCl.grids, items, r)).not.toThrow();
		expect(r.unplaced.map((u) => [u.item.scu, u.reason])).toEqual([[32, 'no-space']]);
		const sides = r.placed.filter((p) => p.gridId !== 'main');
		expect(sides.map((p) => p.gridId).sort()).toEqual(['left', 'right']);
		for (const p of sides) expect(p.dims).toEqual({ x: 2, y: 1, z: 2 });
		expect(r.placed.filter((p) => p.gridId === 'main').every((p) => p.dims.y === 8)).toBe(true);
	});

	it('Avenger Titan: 2 × 4 SCU exactly, 8 SCU not allowed, 9 × 1 SCU leaves one', () => {
		const r = pack(titan.grids, makeItems(4, 2));
		expect(r.unplaced).toEqual([]);
		expect(r.usedScu).toBe(8);
		expect(pack(titan.grids, makeItems(8, 1)).unplaced[0]?.reason).toBe('size-not-allowed');
		const nine = pack(titan.grids, makeItems(1, 9));
		expect(nine.placed).toHaveLength(8);
		expect(nine.unplaced.map((u) => u.reason)).toEqual(['no-space']);
	});

	it('every grid takes a single box of each of its allowed sizes when empty', () => {
		let checks = 0;
		for (const target of ships) {
			for (const grid of target.grids) {
				for (const scu of grid.allowedSizes) {
					const items = makeItems(scu, 1);
					const r = pack([grid], items, [], { restarts: 0 });
					expect(r.placed, `${target.slug}/${grid.id} ${scu} SCU`).toHaveLength(1);
					expect(r.unplaced, `${target.slug}/${grid.id} ${scu} SCU`).toEqual([]);
					checks++;
				}
			}
		}
		expect(checks).toBeGreaterThan(1000);
	});

	it('every grid that allows 1 SCU fills exactly to capacity with 1-SCU boxes, one more is no-space', () => {
		let grids = 0;
		for (const target of ships) {
			for (const grid of target.grids) {
				if (!grid.allowedSizes.includes(1)) continue;
				grids++;
				const n = volume(grid.cells);
				const message = `${target.slug}/${grid.id} ${JSON.stringify(grid.cells)}`;
				const exact = pack([grid], makeItems(1, n), [], { restarts: 0 });
				expect(exact.unplaced, message).toEqual([]);
				expect(exact.usedScu, message).toBe(n);
				expect(exact.fills[0], message).toEqual({ gridId: grid.id, usedCells: n, totalCells: n });
				const over = pack([grid], makeItems(1, n + 1));
				expect(over.placed, message).toHaveLength(n);
				expect(
					over.unplaced.map((u) => u.reason),
					message
				).toEqual(['no-space']);
			}
		}
		expect(grids).toBeGreaterThan(200);
	});

	it('every ship fills its 1-SCU capacity exactly and capacityScu equals the published cargo', () => {
		for (const target of ships) {
			const cap1 = target.grids
				.filter((g) => g.allowedSizes.includes(1))
				.reduce((s, g) => s + volume(g.cells), 0);
			const items = makeItems(1, cap1 + 1);
			const r = pack(target.grids, items);
			expect(() => assertInvariants(target.grids, items, r), target.slug).not.toThrow();
			expect(r.capacityScu, target.slug).toBe(target.cargoScu);
			expect(r.usedScu, target.slug).toBe(cap1);
			expect(r.unplaced.length, target.slug).toBe(1);
			expect(r.unplaced[0].reason, target.slug).toBe(cap1 === 0 ? 'size-not-allowed' : 'no-space');
		}
	});

	it('grids tile exactly with their largest allowed size whenever a single orientation tiles them', () => {
		let checks = 0;
		for (const target of ships) {
			for (const grid of target.grids) {
				const scu = Math.max(...grid.allowedSizes) as ContainerSize;
				const n = volume(grid.cells) / scu;
				if (!Number.isInteger(n)) continue;
				const tiles = containerOrientations(scu).some(
					(d) => grid.cells.x % d.x === 0 && grid.cells.y % d.y === 0 && grid.cells.z % d.z === 0
				);
				if (!tiles) continue;
				checks++;
				const r = pack([grid], makeItems(scu, n));
				expect(r.unplaced, `${target.slug}/${grid.id} ${scu} SCU × ${n}`).toEqual([]);
			}
		}
		expect(checks).toBeGreaterThan(150);
	});
});

/* ---------- hostile input ---------- */

describe('hostile input', () => {
	it('unknown container sizes are reported as size-not-allowed without throwing', () => {
		const bad = [3, 0, -1, 1.5, Number.NaN, 64].map(
			(scu, i) => ({ id: `bad${i}`, scu: scu as ContainerSize, group: 'g' }) satisfies PackItem
		);
		const items = [...bad, ...makeItems(2, 2)];
		const r = pack(c2.grids, items, makeGroups(1));
		expect(r.placed.map((p) => p.itemId).sort()).toEqual(['g-2-0', 'g-2-1']);
		expect(r.unplaced.map((u) => u.item.id).sort()).toEqual(bad.map((b) => b.id).sort());
		expect(r.unplaced.every((u) => u.reason === 'size-not-allowed')).toBe(true);
		expect(stable(pack(c2.grids, items, makeGroups(1)))).toEqual(stable(r));
	});

	it('clamps absurd options and stays deterministic for odd seeds', () => {
		const items = makeItems(8, 12);
		for (const seed of [0, -5, 2.75, 2 ** 40, Number.NaN, Number.POSITIVE_INFINITY]) {
			const a = pack(c2.grids, items, [], { seed, restarts: 3, support: 1.7 });
			const b = pack(c2.grids, items, [], { seed, restarts: 3, support: 1.7 });
			expect(stable(a), `seed ${seed}`).toEqual(stable(b));
			expect(() => assertInvariants(c2.grids, items, a), `seed ${seed}`).not.toThrow();
		}
		const huge = pack(titan.grids, makeItems(1, 9), [], { restarts: 10 ** 9, support: -4 });
		expect(huge.placed).toHaveLength(8);
		const floating = pack(c2.grids, makeItems(1, 3), [], { support: 0 });
		expect(() =>
			assertInvariants(c2.grids, makeItems(1, 3), floating, { support: 0 })
		).not.toThrow();
	});

	it('duplicate and unknown gridOrder entries are harmless', () => {
		const items = makeItems(4, 3);
		const r = pack(zeusCl.grids, items, [], {
			gridOrder: ['right', 'right', 'ghost', 'left', 'main', 'left']
		});
		expect(() => assertInvariants(zeusCl.grids, items, r)).not.toThrow();
		expect(r.placed.map((p) => p.gridId)).toEqual(['right', 'left', 'main']);
	});

	it('an empty hold or an empty manifest gives an empty, well-formed result', () => {
		const none = pack([], makeItems(1, 2));
		expect(none.unplaced.map((u) => u.reason)).toEqual(['size-not-allowed', 'size-not-allowed']);
		expect(none.fills).toEqual([]);
		expect(none.capacityScu).toBe(0);
		const empty = pack(idrisP.grids, []);
		expect(empty.placed).toEqual([]);
		expect(empty.fills).toHaveLength(idrisP.grids.length);
		expect(empty.capacityScu).toBe(idrisP.cargoScu);
		expect(empty.elapsedMs).toBeGreaterThanOrEqual(0);
	});
});

/* ---------- worker client ---------- */

interface FakeWorkerLike {
	onmessage: ((event: MessageEvent<PackResponse>) => void) | null;
	onerror: ((event: ErrorEvent) => void) | null;
	postMessage(message: PackRequest): void;
	terminate(): void;
}

type FakeMode = 'echo' | 'manual' | 'construct-throws' | 'error-on-post';

/** A Worker stand-in that structured-clones like the real thing. */
function fakeWorker(mode: FakeMode) {
	const instances: FakeWorkerLike[] = [];
	const posted: PackRequest[] = [];
	const urls: string[] = [];
	const types: (string | undefined)[] = [];
	let terminated = 0;
	class FakeWorker implements FakeWorkerLike {
		onmessage: FakeWorkerLike['onmessage'] = null;
		onerror: FakeWorkerLike['onerror'] = null;
		constructor(url: URL | string, options?: { type?: string }) {
			if (mode === 'construct-throws') throw new Error('workers are disabled here');
			urls.push(String(url));
			types.push(options?.type);
			instances.push(this);
		}
		postMessage(message: PackRequest): void {
			const request = structuredClone(message);
			posted.push(request);
			if (mode === 'echo') {
				queueMicrotask(() => {
					const data = structuredClone(handlePackRequest(request));
					this.onmessage?.({ data } as MessageEvent<PackResponse>);
				});
			} else if (mode === 'error-on-post') {
				queueMicrotask(() => this.onerror?.({ message: 'module script failed' } as ErrorEvent));
			}
		}
		terminate(): void {
			terminated++;
		}
	}
	return {
		FakeWorker,
		instances,
		posted,
		urls,
		types,
		get terminated() {
			return terminated;
		}
	};
}

describe('packer client', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('without a Worker global it packs synchronously, with elapsedMs populated', async () => {
		expect(typeof Worker).toBe('undefined');
		const client = createPackerClient();
		const items = makeItems(24, 5);
		const r = await client.pack(caterpillar.grids, items, []);
		expect(client.usingWorker).toBe(false);
		expect(stable(r)).toEqual(stable(pack(caterpillar.grids, items, [])));
		expect(Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0).toBe(true);
		const viaProtocol = handlePackRequest({ id: 1, grids: caterpillar.grids, items, groups: [] });
		expect('result' in viaProtocol && viaProtocol.result.elapsedMs >= 0).toBe(true);
	});

	it('falls back when the Worker constructor throws and never retries construction', async () => {
		const fake = fakeWorker('construct-throws');
		vi.stubGlobal('Worker', fake.FakeWorker);
		const client = createPackerClient();
		const items = makeItems(4, 2);
		const a = await client.pack(titan.grids, items, []);
		const b = await client.pack(titan.grids, items, []);
		expect(client.usingWorker).toBe(false);
		expect(fake.instances).toHaveLength(0);
		expect(stable(a)).toEqual(stable(pack(titan.grids, items, [])));
		expect(stable(b)).toEqual(stable(a));
	});

	it('uses a module worker, maps concurrent responses by id and recreates the worker after terminate', async () => {
		const fake = fakeWorker('echo');
		vi.stubGlobal('Worker', fake.FakeWorker);
		const client = createPackerClient();
		const small = makeItems(8, 3);
		const big = makeItems(2, 30);
		const [a, b] = await Promise.all([
			client.pack(c2.grids, small, [], { seed: 3 }),
			client.pack(c2.grids, big, makeGroups(1), { seed: 4 })
		]);
		expect(client.usingWorker).toBe(true);
		expect(fake.instances).toHaveLength(1);
		expect(fake.urls[0].endsWith('packer.worker.ts')).toBe(true);
		expect(fake.types[0]).toBe('module');
		expect(fake.posted.map((p) => p.id)).toEqual([1, 2]);
		expect(stable(a)).toEqual(stable(pack(c2.grids, small, [], { seed: 3 })));
		expect(stable(b)).toEqual(stable(pack(c2.grids, big, makeGroups(1), { seed: 4 })));

		client.terminate();
		expect(client.usingWorker).toBe(false);
		expect(fake.terminated).toBe(1);
		const c = await client.pack(titan.grids, makeItems(1, 2), []);
		expect(c.placed).toHaveLength(2);
		expect(fake.instances).toHaveLength(2);
		client.terminate();
	});

	it('delivers out-of-order responses to the right callers and ignores stray messages', async () => {
		const fake = fakeWorker('manual');
		vi.stubGlobal('Worker', fake.FakeWorker);
		const client = createPackerClient();
		const first = client.pack(titan.grids, makeItems(1, 3), []);
		const second = client.pack(titan.grids, makeItems(1, 5), []);
		const worker = fake.instances[0];
		expect(fake.posted).toHaveLength(2);
		expect(() =>
			worker.onmessage?.({
				data: { id: 999, error: 'nobody asked' }
			} as MessageEvent<PackResponse>)
		).not.toThrow();
		worker.onmessage?.({ data: handlePackRequest(fake.posted[1]) } as MessageEvent<PackResponse>);
		worker.onmessage?.({ data: handlePackRequest(fake.posted[0]) } as MessageEvent<PackResponse>);
		expect((await first).placed).toHaveLength(3);
		expect((await second).placed).toHaveLength(5);

		const third = client.pack(titan.grids, makeItems(1, 1), []);
		worker.onmessage?.({ data: { id: 3, error: 'boom' } } as MessageEvent<PackResponse>);
		await expect(third).rejects.toThrow('boom');
		client.terminate();
	});

	it('a worker that fails to load settles the pending request and falls back for good', async () => {
		const fake = fakeWorker('error-on-post');
		vi.stubGlobal('Worker', fake.FakeWorker);
		const client = createPackerClient();
		const items = makeItems(4, 2);
		const settled = await client.pack(titan.grids, items, []).then(
			(r) => ({ ok: true as const, r }),
			(e: unknown) => ({ ok: false as const, e })
		);
		if (settled.ok) expect(stable(settled.r)).toEqual(stable(pack(titan.grids, items, [])));
		else expect(settled.e).toBeInstanceOf(Error);
		expect(client.usingWorker).toBe(false);
		expect(fake.terminated).toBe(1);
		const again = await client.pack(titan.grids, items, []);
		expect(stable(again)).toEqual(stable(pack(titan.grids, items, [])));
		expect(fake.instances).toHaveLength(1);
	});
});

/* ---------- performance ---------- */

describe('performance on real ships', () => {
	function timed(label: string, run: () => PackResult): { ms: number; result: PackResult } {
		run();
		const start = performance.now();
		const result = run();
		const ms = performance.now() - start;
		console.info(
			`${label}: ${ms.toFixed(1)} ms (elapsedMs ${result.elapsedMs.toFixed(1)}), ${result.placed.length} placed, ${result.unplaced.length} unplaced`
		);
		expect(result.elapsedMs).toBeLessThanOrEqual(ms + 5);
		return { ms, result };
	}

	it('Idris-P with 1375 × 1 SCU (one over capacity, five passes) is fast', () => {
		const { ms, result } = timed('Idris-P 1375 × 1 SCU', () =>
			pack(idrisP.grids, makeItems(1, 1375))
		);
		expect(result.unplaced).toHaveLength(1);
		expect(ms).toBeLessThan(1500); // measured ~45 ms
	});

	it('the UI maximum (4 groups × 7 sizes × 999 boxes) on an M2 stays interactive', () => {
		const m2 = ship('crusader-m2-hercules-starlifter');
		const items: PackItem[] = [];
		const groups = makeGroups(4);
		for (const g of groups)
			for (const scu of CONTAINER_SIZES) items.push(...makeItems(scu, 999, g.id, `${g.id}-${scu}`));
		expect(items).toHaveLength(27972);
		const { ms, result } = timed('M2 27 972 boxes', () => pack(m2.grids, items, groups));
		expect(result.usedScu).toBe(result.capacityScu);
		expect(ms).toBeLessThan(5000); // measured ~270 ms
	});

	it('Hull C with 145 × 32 SCU is fast', () => {
		const { ms } = timed('Hull C 145 × 32 SCU', () => pack(hullC.grids, makeItems(32, 145)));
		expect(ms).toBeLessThan(1000); // measured ~2 ms
	});
});
