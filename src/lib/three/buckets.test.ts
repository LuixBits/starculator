import { describe, expect, it } from 'vitest';
import { CELL_M } from '../data/types.ts';
import type { PackGroup, PackItem, Placement } from '../data/types.ts';
import { BucketCache, MIN_LIMIT, SEAM_M, groupPlacements, limitFor } from './buckets.ts';
import { layoutGrids } from './layout.ts';
import { crateColor } from './palette.ts';
import { grid } from './test-grids.ts';

const layout = layoutGrids([grid({ id: 'main', cells: { x: 4, y: 8, z: 4 } })]);
const groups: PackGroup[] = [
	{ id: 'a', label: 'A', colorIndex: 0, unloadOrder: 0 },
	{ id: 'b', label: 'B', colorIndex: 1, unloadOrder: 1 }
];

function place(itemId: string, order: number, dims = { x: 2, y: 2, z: 2 }, x = 0): Placement {
	return { itemId, gridId: 'main', at: { x, y: 0, z: 0 }, dims, order };
}

function item(id: string, group: string): PackItem {
	return { id, scu: 8, group };
}

describe('limitFor', () => {
	it('starts at MIN_LIMIT and doubles', () => {
		expect(limitFor(0)).toBe(MIN_LIMIT);
		expect(limitFor(MIN_LIMIT)).toBe(MIN_LIMIT);
		expect(limitFor(MIN_LIMIT + 1)).toBe(MIN_LIMIT * 2);
		expect(limitFor(100)).toBe(128);
	});
});

describe('groupPlacements', () => {
	it('buckets by oriented dims and group colour, boxes in loading order', () => {
		const cache = new BucketCache();
		const { shells, boxes } = groupPlacements(
			{
				placements: [
					place('i2', 1, { x: 2, y: 2, z: 2 }, 2),
					place('i1', 0),
					place('i3', 2, { x: 2, y: 1, z: 1 })
				],
				items: [item('i1', 'a'), item('i2', 'a'), item('i3', 'b')],
				groups,
				layout
			},
			cache
		);
		expect(shells.map((s) => s.key)).toEqual([
			`2x1x1|${crateColor(1)}|16`,
			`2x2x2|${crateColor(0)}|16`
		]);
		expect(boxes.get(shells[1].key)?.map((b) => [b.itemId, b.rank])).toEqual([
			['i1', 0],
			['i2', 1]
		]);
		expect(shells[1].size).toEqual([2 * CELL_M, 2 * CELL_M, 2 * CELL_M]);
		expect(shells[1].args).toEqual([2 * CELL_M - SEAM_M, 2 * CELL_M - SEAM_M, 2 * CELL_M - SEAM_M]);
	});

	it('keeps the same shell object across re-packs while dims, colour and capacity match', () => {
		const cache = new BucketCache();
		const items = [item('i1', 'a'), item('i2', 'a')];
		const first = groupPlacements({ placements: [place('i1', 0)], items, groups, layout }, cache);
		const second = groupPlacements(
			{ placements: [place('i1', 0), place('i2', 1, undefined, 2)], items, groups, layout },
			cache
		);
		expect(second.shells[0]).toBe(first.shells[0]);
		expect(second.shells[0].args).toBe(first.shells[0].args);
		expect(second.boxes.get(second.shells[0].key)).toHaveLength(2);
	});

	it('hands out a new shell once the box count outgrows the capacity', () => {
		const cache = new BucketCache();
		const many = (n: number) =>
			Array.from({ length: n }, (_, i) => place(`i${i}`, i, { x: 1, y: 1, z: 1 }, i % 4));
		const items = Array.from({ length: 20 }, (_, i) => item(`i${i}`, 'a'));
		const small = groupPlacements({ placements: many(MIN_LIMIT), items, groups, layout }, cache);
		const big = groupPlacements({ placements: many(MIN_LIMIT + 1), items, groups, layout }, cache);
		expect(small.shells[0].limit).toBe(MIN_LIMIT);
		expect(big.shells[0].limit).toBe(MIN_LIMIT * 2);
		expect(big.shells[0]).not.toBe(small.shells[0]);
	});

	it('skips placements whose grid is not in the layout and defaults unknown groups to colour 0', () => {
		const cache = new BucketCache();
		const { shells, boxes } = groupPlacements(
			{
				placements: [place('i1', 0), { ...place('i2', 1), gridId: 'ghost' }],
				items: [item('i1', 'nope')],
				groups,
				layout
			},
			cache
		);
		expect(shells).toHaveLength(1);
		expect(shells[0].color).toBe(crateColor(0));
		expect(boxes.get(shells[0].key)?.map((b) => b.itemId)).toEqual(['i1']);
	});
});
