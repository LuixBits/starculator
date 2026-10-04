import { describe, expect, it } from 'vitest';
import type { CargoGrid, PackItem, Placement } from '../data/types.ts';
import { depthFromDoor, doorOf } from './geometry.ts';
import { expandCounts } from './helpers.ts';
import { orderGrids, pack, resolveOptions } from './pack.ts';
import {
	c2,
	caterpillarBay,
	cutlassBlack,
	fixtures,
	hullC,
	makeGrid,
	titan,
	zeusCl
} from './fixtures.ts';
import {
	assertInvariants,
	makeGroups,
	makeItems,
	meanDepth,
	randomItems,
	seededRng,
	stable
} from './test-helpers.ts';

const depthIn = (grids: readonly CargoGrid[]) => (p: Placement) => {
	const grid = grids.find((g) => g.id === p.gridId)!;
	return depthFromDoor(grid.cells, doorOf(grid), p.at, p.dims);
};

describe('perfect packs', () => {
	it('Avenger Titan takes exactly two 4-SCU boxes', () => {
		const items = makeItems(4, 2);
		const r = pack(titan, items);
		assertInvariants(titan, items, r);
		expect(r.placed).toHaveLength(2);
		expect(r.usedScu).toBe(8);
		expect(r.fills[0]).toEqual({ gridId: 'titan-main', usedCells: 8, totalCells: 8 });

		const three = makeItems(4, 3);
		const r3 = pack(titan, three);
		assertInvariants(titan, three, r3);
		expect(r3.unplaced).toHaveLength(1);
		expect(r3.unplaced[0].reason).toBe('no-space');
	});

	it('Avenger Titan fills completely with eight 1-SCU or four 2-SCU boxes', () => {
		for (const items of [
			makeItems(1, 8),
			makeItems(2, 4),
			[...makeItems(4, 1), ...makeItems(2, 1), ...makeItems(1, 2)]
		]) {
			const r = pack(titan, items);
			assertInvariants(titan, items, r);
			expect(r.unplaced).toEqual([]);
			expect(r.usedScu).toBe(8);
		}
	});

	it('Hull C takes exactly 144 × 32 SCU and rejects everything else', () => {
		const items = makeItems(32, 144);
		const r = pack(hullC, items, [], { restarts: 0 });
		assertInvariants(hullC, items, r);
		expect(r.unplaced).toEqual([]);
		expect(r.usedScu).toBe(4608);
		expect(r.capacityScu).toBe(4608);
		for (const f of r.fills) expect(f.usedCells).toBe(f.totalCells);

		const extra = [...items, ...makeItems(32, 1, 'g', 'x'), ...makeItems(16, 1, 'g', 'y')];
		const r2 = pack(hullC, extra, [], { restarts: 1 });
		assertInvariants(hullC, extra, r2);
		expect(r2.unplaced.map((u) => [u.item.scu, u.reason])).toEqual([
			[32, 'no-space'],
			[16, 'size-not-allowed']
		]);
	});

	it('Caterpillar module takes four 24-SCU boxes, nothing leaks into walkway or ladder', () => {
		const items = makeItems(24, 4);
		const r = pack(caterpillarBay, items);
		assertInvariants(caterpillarBay, items, r);
		expect(r.unplaced).toEqual([]);
		expect(r.placed.every((p) => p.gridId === 'cat-module-1')).toBe(true);
		expect(r.fills.find((f) => f.gridId === 'cat-module-1')?.usedCells).toBe(96);

		const fifth = makeItems(24, 5);
		const r5 = pack(caterpillarBay, fifth);
		expect(r5.unplaced).toHaveLength(1);
		expect(r5.unplaced[0].reason).toBe('no-space');
	});

	it('Caterpillar walkway and ladder take 2-SCU boxes only in fitting orientations', () => {
		const items = [
			...makeItems(2, 4, 'g', 'w'),
			...makeItems(2, 10, 'g', 'l'),
			...makeItems(1, 10, 'g', 'o')
		];
		const r = pack(caterpillarBay.slice(1), items);
		assertInvariants(caterpillarBay.slice(1), items, r);
		expect(r.usedScu).toBe(28);
		expect(r.unplaced.every((u) => u.reason === 'no-space')).toBe(true);
	});

	it('Zeus side grids need rotation for a 4-SCU box', () => {
		const side = [zeusCl[1]];
		const items = makeItems(4, 1);
		const rotated = pack(side, items);
		assertInvariants(side, items, rotated);
		expect(rotated.placed[0].dims).toEqual({ x: 2, y: 1, z: 2 });

		const fixed = pack(side, items, [], { allowRotation: false });
		assertInvariants(side, items, fixed, { allowRotation: false });
		expect(fixed.unplaced[0].reason).toBe('too-large-for-any-grid');

		// main 5×8×3 holds two 32-SCU boxes lying along y; the third has no room
		const wholeItems = [...makeItems(4, 3), ...makeItems(32, 3)];
		const whole = pack(zeusCl, wholeItems);
		assertInvariants(zeusCl, wholeItems, whole);
		expect(whole.unplaced.map((u) => [u.item.scu, u.reason])).toEqual([[32, 'no-space']]);
		expect(whole.placed.filter((p) => p.dims.y === 8)).toHaveLength(2);
	});
});

describe('unplaced reasons', () => {
	it('distinguishes not-allowed, too-large and no-space', () => {
		const r = pack(titan, [...makeItems(8, 1), ...makeItems(4, 3)]);
		expect(r.unplaced.map((u) => u.reason)).toEqual(['size-not-allowed', 'no-space']);

		const tiny = [makeGrid({ id: 'tiny', cells: { x: 1, y: 2, z: 1 }, allowedSizes: [1, 2, 32] })];
		const r2 = pack(tiny, [...makeItems(32, 1), ...makeItems(2, 1), ...makeItems(1, 1)]);
		assertInvariants(tiny, [...makeItems(32, 1), ...makeItems(2, 1), ...makeItems(1, 1)], r2);
		expect(r2.unplaced.map((u) => [u.item.scu, u.reason])).toEqual([
			[32, 'too-large-for-any-grid'],
			[1, 'no-space']
		]);
	});

	it('reports size-not-allowed for everything when there are no grids', () => {
		const items = makeItems(1, 3);
		const r = pack([], items);
		expect(r.placed).toEqual([]);
		expect(r.unplaced.every((u) => u.reason === 'size-not-allowed')).toBe(true);
		expect(r.capacityScu).toBe(0);
		expect(r.fills).toEqual([]);
	});

	it('handles an empty item list', () => {
		const r = pack(c2, []);
		expect(r.placed).toEqual([]);
		expect(r.unplaced).toEqual([]);
		expect(r.usedScu).toBe(0);
		expect(r.capacityScu).toBe(696);
	});
});

describe('properties on random item sets', () => {
	const cases = Object.entries(fixtures);

	it.each(cases)('%s: invariants hold with full support', (_name, grids) => {
		for (let seed = 1; seed <= 6; seed++) {
			const rng = seededRng(seed);
			const items = randomItems(rng, 20 + Math.floor(rng() * 60), 3);
			const r = pack(grids, items, makeGroups(3), { seed });
			expect(() => assertInvariants(grids, items, r)).not.toThrow();
		}
	});

	it.each(cases)('%s: invariants hold with 75 % support and no rotation', (_name, grids) => {
		for (let seed = 11; seed <= 14; seed++) {
			const rng = seededRng(seed);
			const items = randomItems(rng, 40, 2);
			const r = pack(grids, items, makeGroups(2), { seed, support: 0.75, allowRotation: false });
			expect(() =>
				assertInvariants(grids, items, r, { support: 0.75, allowRotation: false })
			).not.toThrow();
		}
	});

	it('is deterministic for a given seed and changes only the result, never validity, across seeds', () => {
		const rng = seededRng(99);
		const items = randomItems(rng, 120, 3);
		const groups = makeGroups(3);
		const a = pack(c2, items, groups, { seed: 5 });
		const b = pack(c2, items, groups, { seed: 5 });
		expect(stable(a)).toEqual(stable(b));
		for (const seed of [1, 2, 3]) {
			const r = pack(c2, items, groups, { seed });
			assertInvariants(c2, items, r);
		}
	});

	it('restarts never make the result worse than the deterministic pass', () => {
		for (let seed = 21; seed <= 26; seed++) {
			const rng = seededRng(seed);
			const items = randomItems(rng, 50 + Math.floor(rng() * 80), 2, [1, 2, 4, 8, 16]);
			const single = pack(cutlassBlack, items, makeGroups(2), { restarts: 0 });
			const multi = pack(cutlassBlack, items, makeGroups(2), { restarts: 6, seed });
			assertInvariants(cutlassBlack, items, multi);
			expect(multi.unplaced.length).toBeLessThanOrEqual(single.unplaced.length);
			if (multi.unplaced.length === single.unplaced.length) {
				expect(multi.usedScu).toBeGreaterThanOrEqual(single.usedScu);
			}
		}
	});
});

describe('loading and unload order', () => {
	it('loads the last-unloaded group first and keeps the first-unloaded group nearer the door', () => {
		const groups = makeGroups(2); // g0 unloads first, g1 unloads last
		const items = [...makeItems(4, 6, 'g0'), ...makeItems(4, 6, 'g1')];
		for (const door of [null, '+y', '-x', '+x'] as const) {
			const grids = [{ ...cutlassBlack[0], door }];
			const r = pack(grids, items, groups);
			assertInvariants(grids, items, r);
			const a = r.placed.filter((p) => p.itemId.startsWith('g0'));
			const b = r.placed.filter((p) => p.itemId.startsWith('g1'));
			expect(a.length).toBeGreaterThan(0);
			expect(b.length).toBeGreaterThan(0);
			expect(Math.max(...b.map((p) => p.order))).toBeLessThan(Math.min(...a.map((p) => p.order)));
			const depth = depthIn(grids);
			expect(meanDepth(a, depth)).toBeLessThan(meanDepth(b, depth));
		}
	});

	it('packs a single group from the back wall forward', () => {
		const items = makeItems(1, 3);
		const r = pack(titan, items);
		// door is -y (y = 0): the first box must touch the far wall at y = 3
		expect(r.placed[0].at.y).toBe(3);
		expect(r.placed.every((p) => p.at.y >= 2)).toBe(true);
	});

	it('orders by group, then biggest first, then input order', () => {
		const groups = makeGroups(2);
		const items: PackItem[] = [
			{ id: 'a1', scu: 1, group: 'g0' },
			{ id: 'b4', scu: 4, group: 'g1' },
			{ id: 'a2', scu: 2, group: 'g0' },
			{ id: 'b1', scu: 1, group: 'g1' },
			{ id: 'u8', scu: 8, group: 'unknown' } // unknown groups load first
		];
		const r = pack(c2, items, groups);
		expect(r.placed.map((p) => p.itemId)).toEqual(['u8', 'b4', 'b1', 'a2', 'a1']);
	});
});

describe('grid order and locks', () => {
	it('visits gridOrder first, then the rest largest first', () => {
		expect(orderGrids(c2, [])).toEqual([0, 1]);
		expect(orderGrids(c2, ['c2-small', 'nope'])).toEqual([1, 0]);
		expect(orderGrids(zeusCl, ['zeus-right'])).toEqual([2, 0, 1]);

		const items = makeItems(8, 3);
		const def = pack(c2, items);
		expect(def.placed.every((p) => p.gridId === 'c2-large')).toBe(true);
		const pref = pack(c2, items, [], { gridOrder: ['c2-small'] });
		expect(pref.placed.every((p) => p.gridId === 'c2-small')).toBe(true);
	});

	it('keeps locked placements exactly and first in the loading order', () => {
		const items = [...makeItems(4, 2), ...makeItems(1, 0)];
		const lock: Placement = {
			itemId: 'g-4-1',
			gridId: 'titan-main',
			at: { x: 0, y: 1, z: 0 },
			dims: { x: 2, y: 2, z: 1 },
			order: 42
		};
		const r = pack(titan, items, [], { locked: [lock] });
		assertInvariants(titan, items, r);
		expect(r.placed[0]).toEqual({ ...lock, order: 0 });
		// the lock sits in the middle, so the other 4-SCU box cannot fit anymore
		expect(r.unplaced.map((u) => u.item.id)).toEqual(['g-4-0']);
		expect(r.fills[0].usedCells).toBe(4);
	});

	it('drops locks it cannot honour and packs their items normally', () => {
		const items = makeItems(4, 2);
		const bad: Placement[] = [
			{
				itemId: 'g-4-0',
				gridId: 'titan-main',
				at: { x: 1, y: 0, z: 0 },
				dims: { x: 2, y: 2, z: 1 },
				order: 0
			},
			{
				itemId: 'g-4-1',
				gridId: 'other',
				at: { x: 0, y: 0, z: 0 },
				dims: { x: 2, y: 2, z: 1 },
				order: 1
			},
			{
				itemId: 'ghost',
				gridId: 'titan-main',
				at: { x: 0, y: 0, z: 0 },
				dims: { x: 2, y: 2, z: 1 },
				order: 2
			},
			{
				itemId: 'g-4-1',
				gridId: 'titan-main',
				at: { x: 0, y: 0, z: 0 },
				dims: { x: 2, y: 1, z: 1 },
				order: 3
			}
		];
		const r = pack(titan, items, [], { locked: bad });
		assertInvariants(titan, items, r);
		expect(r.placed).toHaveLength(2);
		expect(r.unplaced).toEqual([]);
	});

	it('lets a locked float stand and respects the support threshold around it', () => {
		const grid = [makeGrid({ id: 'cube', cells: { x: 2, y: 2, z: 2 }, allowedSizes: [1, 4] })];
		const ones = makeItems(1, 3, 'g', 'one');
		const four = makeItems(4, 1, 'g', 'four');
		const locked: Placement[] = ones.map((item, i) => ({
			itemId: item.id,
			gridId: 'cube',
			at: { x: i % 2, y: Math.floor(i / 2), z: 0 },
			dims: { x: 1, y: 1, z: 1 },
			order: i
		}));
		const strict = pack(grid, [...ones, ...four], [], { locked });
		expect(strict.unplaced.map((u) => u.item.id)).toEqual(['four-4-0']);
		const relaxed = pack(grid, [...ones, ...four], [], { locked, support: 0.75 });
		assertInvariants(grid, [...ones, ...four], relaxed, { support: 0.75 });
		expect(relaxed.unplaced).toEqual([]);
		expect(relaxed.placed.at(-1)?.at.z).toBe(1);
	});
});

describe('options', () => {
	it('resolves defaults and clamps bad values', () => {
		expect(resolveOptions()).toEqual({
			support: 1,
			allowRotation: true,
			gridOrder: [],
			locked: [],
			restarts: 4,
			seed: 1
		});
		expect(resolveOptions({ support: 7, restarts: -3 }).support).toBe(1);
		expect(resolveOptions({ support: 7, restarts: -3 }).restarts).toBe(0);
		expect(resolveOptions({ restarts: 1000 }).restarts).toBe(64);
		expect(resolveOptions({ support: Number.NaN }).support).toBe(1);
	});

	it('honours allowRotation = false', () => {
		const strip = [makeGrid({ id: 'strip', cells: { x: 1, y: 4, z: 1 }, allowedSizes: [1, 2] })];
		const items = makeItems(2, 2);
		expect(pack(strip, items, [], { allowRotation: false }).unplaced[0]?.reason).toBe(
			'too-large-for-any-grid'
		);
		const rotated = pack(strip, items);
		assertInvariants(strip, items, rotated);
		expect(rotated.unplaced).toEqual([]);
	});
});

describe('performance', () => {
	it('packs 300 mixed boxes into a C2 quickly', () => {
		// 840 SCU of mostly small boxes against 696 SCU of hold: the scan-heavy case.
		const counts = { 1: 60, 2: 50, 4: 25, 8: 10, 16: 5 } as const;
		const items = [...expandCounts(counts, 'g1'), ...expandCounts(counts, 'g0')];
		expect(items).toHaveLength(300);
		const groups = makeGroups(2);
		pack(c2, items, groups); // warm up the JIT once
		const start = performance.now();
		const r = pack(c2, items, groups);
		const ms = performance.now() - start;
		assertInvariants(c2, items, r);
		expect(r.usedScu).toBe(r.capacityScu);
		console.info(
			`C2 300 mixed boxes (5 passes): ${ms.toFixed(1)} ms, ${r.usedScu}/${r.capacityScu} SCU`
		);
		expect(ms).toBeLessThan(600); // target 150 ms; generous for CI
	});

	it('packs 144 × 32 SCU into a Hull C quickly', () => {
		const items = makeItems(32, 144);
		pack(hullC, items);
		const start = performance.now();
		const r = pack(hullC, items);
		const ms = performance.now() - start;
		expect(r.unplaced).toEqual([]);
		console.info(`Hull C 144 × 32 SCU: ${ms.toFixed(1)} ms`);
		expect(ms).toBeLessThan(4000); // target 1 s; generous for CI
	});
});
