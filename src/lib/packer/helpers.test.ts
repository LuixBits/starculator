import { describe, expect, it } from 'vitest';
import type { Placement } from '../data/types.ts';
import {
	expandCounts,
	gridCapacityByContainer,
	validatePlacement,
	validatePlan
} from './helpers.ts';
import { pack } from './pack.ts';
import { caterpillarBay, hullC, titan, zeusCl } from './fixtures.ts';

describe('expandCounts', () => {
	it('expands counts into unique items, largest first', () => {
		const items = expandCounts({ 4: 2, 1: 3, 16: 1 }, 'red');
		expect(items.map((i) => i.scu)).toEqual([16, 4, 4, 1, 1, 1]);
		expect(new Set(items.map((i) => i.id)).size).toBe(6);
		expect(items[0]).toEqual({ id: 'red-16scu-1', scu: 16, group: 'red', label: '16 SCU' });
		expect(items.every((i) => i.group === 'red')).toBe(true);
	});

	it('ignores zero, negative, fractional and invalid counts', () => {
		expect(expandCounts({ 1: 0, 2: -4, 4: Number.NaN, 8: 2.9 }, 'g').map((i) => i.scu)).toEqual([
			8, 8
		]);
		expect(expandCounts({}, 'g')).toEqual([]);
	});
});

describe('validatePlacement', () => {
	const base: Placement = {
		itemId: 'a',
		gridId: 'titan-main',
		at: { x: 0, y: 0, z: 0 },
		dims: { x: 2, y: 2, z: 1 },
		order: 0
	};
	const others: Placement[] = [
		{
			itemId: 'b',
			gridId: 'titan-main',
			at: { x: 0, y: 2, z: 0 },
			dims: { x: 2, y: 2, z: 1 },
			order: 1
		}
	];

	it('accepts a valid move and ignores the moved box itself', () => {
		const v = validatePlacement(titan, [base, ...others], base);
		expect(v).toEqual({ ok: true, problems: [], supportFraction: 1 });
		const nudged = validatePlacement(titan, [base, ...others], {
			...base,
			at: { x: 0, y: 0, z: 0 }
		});
		expect(nudged.ok).toBe(true);
	});

	it('reports every problem with a code', () => {
		const codes = (p: Placement) => validatePlacement(titan, others, p).problems.map((x) => x.code);
		expect(codes({ ...base, gridId: 'nope' })).toEqual(['unknown-grid']);
		expect(codes({ ...base, dims: { x: 3, y: 1, z: 1 } })).toEqual(['invalid-dims']);
		expect(codes({ ...base, at: { x: 1, y: 0, z: 0 } })).toEqual(['out-of-bounds']);
		expect(codes({ ...base, at: { x: 0, y: 1, z: 0 } })).toEqual(['overlap']);
		expect(codes({ ...base, dims: { x: 2, y: 2, z: 2 } })).toEqual([
			'size-not-allowed',
			'out-of-bounds'
		]);
		const overlap = validatePlacement(titan, others, { ...base, at: { x: 0, y: 1, z: 0 } });
		expect(overlap.problems[0].collidesWith).toEqual(['b']);
	});

	it('checks support against the threshold', () => {
		const stacked: Placement[] = [
			{
				itemId: 'floor',
				gridId: 'cat-module-1',
				at: { x: 0, y: 0, z: 0 },
				dims: { x: 2, y: 1, z: 1 },
				order: 0
			}
		];
		const top: Placement = {
			itemId: 'top',
			gridId: 'cat-module-1',
			at: { x: 0, y: 0, z: 1 },
			dims: { x: 2, y: 2, z: 1 },
			order: 1
		};
		const strict = validatePlacement(caterpillarBay, stacked, top);
		expect(strict.ok).toBe(false);
		expect(strict.problems.map((p) => p.code)).toEqual(['unsupported']);
		expect(strict.supportFraction).toBe(0.5);
		expect(validatePlacement(caterpillarBay, stacked, top, { support: 0.5 }).ok).toBe(true);
		const floating = validatePlacement(caterpillarBay, [], { ...top, at: { x: 0, y: 0, z: 2 } });
		expect(floating.supportFraction).toBe(0);
	});

	it('can forbid rotation', () => {
		const side: Placement = {
			itemId: 's',
			gridId: 'zeus-left',
			at: { x: 0, y: 0, z: 0 },
			dims: { x: 2, y: 1, z: 2 },
			order: 0
		};
		expect(validatePlacement(zeusCl, [], side).ok).toBe(true);
		expect(validatePlacement(zeusCl, [], side, { allowRotation: false }).problems[0].code).toBe(
			'rotation-not-allowed'
		);
	});
});

describe('validatePlan', () => {
	it('flags boxes left unsupported after a manual move', () => {
		const r = pack(caterpillarBay, [
			{ id: 'low', scu: 8, group: 'g' },
			{ id: 'high', scu: 8, group: 'g' },
			...Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, scu: 8 as const, group: 'g' }))
		]);
		expect(validatePlan(caterpillarBay, r.placed).size).toBe(0);
		const upper = r.placed.find((p) => p.at.z > 0)!;
		const below = r.placed.find(
			(p) =>
				p.at.z === 0 && p.at.x === upper.at.x && p.at.y === upper.at.y && p.gridId === upper.gridId
		)!;
		const moved = r.placed.filter((p) => p.itemId !== below.itemId);
		const failures = validatePlan(caterpillarBay, moved);
		expect(failures.get(upper.itemId)?.problems.map((p) => p.code)).toEqual(['unsupported']);
	});
});

describe('gridCapacityByContainer', () => {
	it('counts how many of each size fit alone', () => {
		expect(gridCapacityByContainer(titan[0])).toEqual({
			1: 8,
			2: 4,
			4: 2,
			8: 0,
			16: 0,
			24: 0,
			32: 0
		});
		expect(gridCapacityByContainer(hullC[0])).toEqual({
			1: 0,
			2: 0,
			4: 0,
			8: 0,
			16: 0,
			24: 0,
			32: 12
		});
		expect(gridCapacityByContainer(hullC[8])[32]).toBe(6);
		const module = gridCapacityByContainer(caterpillarBay[0]);
		expect(module[24]).toBe(4);
		expect(module[16]).toBe(6);
		expect(module[32]).toBe(0);
		expect(module[1]).toBe(96);
		expect(gridCapacityByContainer(zeusCl[1])).toEqual({
			1: 4,
			2: 2,
			4: 1,
			8: 0,
			16: 0,
			24: 0,
			32: 0
		});
		expect(gridCapacityByContainer(zeusCl[1], { allowRotation: false })[4]).toBe(0);
	});
});
