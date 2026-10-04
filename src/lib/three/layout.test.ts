import { describe, expect, it } from 'vitest';
import {
	BAY_GAP_CELLS,
	GRID_GAP_CELLS,
	MAX_ROW_CELLS,
	ROW_GAP_CELLS,
	layoutGrids
} from './layout.ts';
import { grid } from './test-grids.ts';

describe('layoutGrids (schematic auto-layout)', () => {
	it('returns an empty, zero-sized layout for no grids', () => {
		const layout = layoutGrids([]);
		expect(layout.grids).toEqual([]);
		expect(layout.bays).toEqual([]);
		expect(layout.min).toEqual({ x: 0, y: 0, z: 0 });
		expect(layout.max).toEqual({ x: 0, y: 0, z: 0 });
		expect(layout.curated).toBe(false);
	});

	it('centres a single grid on the origin', () => {
		const layout = layoutGrids([grid({ id: 'main', cells: { x: 4, y: 6, z: 2 } })]);
		expect(layout.grids[0].origin).toEqual({ x: -2, y: -3, z: 0 });
		expect(layout.min).toEqual({ x: -2, y: -3, z: 0 });
		expect(layout.max).toEqual({ x: 2, y: 3, z: 2 });
		expect(layout.curated).toBe(false);
	});

	it('separates grids of one bay by 1 cell and bays by 2 cells, in input order', () => {
		const layout = layoutGrids([
			grid({ id: 'module', cells: { x: 4, y: 6, z: 4 }, bay: 'module-1' }),
			grid({ id: 'walkway', cells: { x: 4, y: 1, z: 2 }, bay: 'module-1' }),
			grid({ id: 'nose', cells: { x: 5, y: 4, z: 3 }, bay: 'nose' })
		]);
		const [module, walkway, nose] = layout.grids;
		expect(walkway.origin.x - (module.origin.x + 4)).toBe(GRID_GAP_CELLS);
		expect(nose.origin.x - (walkway.origin.x + 4)).toBe(BAY_GAP_CELLS);
		// Total width 4 + 1 + 4 + 2 + 5 = 16 → centred at x = 0.
		expect(layout.min.x).toBe(-8);
		expect(layout.max.x).toBe(8);
	});

	it('aligns front faces and centres the deepest grid on y', () => {
		const layout = layoutGrids([
			grid({ id: 'a', cells: { x: 2, y: 6, z: 1 } }),
			grid({ id: 'b', cells: { x: 2, y: 2, z: 1 } })
		]);
		for (const p of layout.grids) expect(p.origin.y).toBe(-3);
		expect(layout.min.y).toBe(-3);
		expect(layout.max.y).toBe(3);
	});

	it('keeps all grids on the floor', () => {
		const layout = layoutGrids([
			grid({ id: 'a', cells: { x: 2, y: 2, z: 4 } }),
			grid({ id: 'b', cells: { x: 2, y: 2, z: 1 } })
		]);
		for (const p of layout.grids) expect(p.origin.z).toBe(0);
		expect(layout.max.z).toBe(4);
	});

	it('groups bays with labels and bounds; bay-less grids form their own bay', () => {
		const layout = layoutGrids([
			grid({ id: 'm1', cells: { x: 4, y: 6, z: 4 }, bay: 'module-1' }),
			grid({ id: 'm1-ladder', cells: { x: 1, y: 5, z: 4 }, bay: 'module-1' }),
			grid({ id: 'side', name: 'Left side', cells: { x: 2, y: 1, z: 2 } })
		]);
		expect(layout.bays.map((b) => b.key)).toEqual(['module-1', 'side']);
		expect(layout.bays[0].label).toBe('Module 1');
		expect(layout.bays[0].gridIds).toEqual(['m1', 'm1-ladder']);
		expect(layout.bays[0].max.x - layout.bays[0].min.x).toBe(4 + GRID_GAP_CELLS + 1);
		expect(layout.bays[1].label).toBe('Left side');
	});

	it('wraps bays into a new row behind the first once a row would exceed MAX_ROW_CELLS', () => {
		// Five Caterpillar-like bays of 11 cells: three fit in 40 (37), the rest wrap.
		const grids = [1, 2, 3, 4, 5].flatMap((n) => [
			grid({ id: `m${n}`, cells: { x: 4, y: 6, z: 4 }, bay: `module-${n}` }),
			grid({ id: `m${n}-walkway`, cells: { x: 4, y: 1, z: 2 }, bay: `module-${n}` }),
			grid({ id: `m${n}-ladder`, cells: { x: 1, y: 5, z: 4 }, bay: `module-${n}` })
		]);
		const layout = layoutGrids(grids);
		const y = (id: string) => layout.byId.get(id)?.origin.y ?? NaN;
		expect(y('m1')).toBe(y('m3'));
		expect(y('m4')).toBe(y('m5'));
		expect(y('m4') - y('m1')).toBe(6 + ROW_GAP_CELLS);
		expect(layout.max.x - layout.min.x).toBe(37);
		expect(layout.max.x - layout.min.x).toBeLessThanOrEqual(MAX_ROW_CELLS);
		// Each row is centred on x; the two-bay row is narrower than the three-bay row.
		expect(layout.byId.get('m4')?.origin.x).toBeGreaterThan(layout.byId.get('m1')?.origin.x ?? 0);
		// The block of rows is centred on y.
		expect(layout.min.y).toBe(-layout.max.y);
	});

	it('balances rows so the last one is not a lonely leftover', () => {
		// Hull C: eight 8-wide and eight 4-wide bay-less grids. Greedy packing at 40
		// cells gives rows of 38, 38, 40 and 4; the balanced limit gives 28, 28, 30, 34.
		const grids = [
			...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
				grid({ id: `main-${n}`, cells: { x: 8, y: 8, z: 6 } })
			),
			...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
				grid({ id: `outer-${n}`, cells: { x: 4, y: 8, z: 6 } })
			)
		];
		const layout = layoutGrids(grids);
		const rowYs = [...new Set(layout.grids.map((p) => p.origin.y))].sort((a, b) => a - b);
		expect(rowYs).toHaveLength(4);
		const widthOfRow = (y: number) => {
			const row = layout.grids.filter((p) => p.origin.y === y);
			return (
				Math.max(...row.map((p) => p.origin.x + p.grid.cells.x)) -
				Math.min(...row.map((p) => p.origin.x))
			);
		};
		expect(rowYs.map(widthOfRow)).toEqual([28, 28, 30, 34]);
		expect(layout.max.x - layout.min.x).toBe(34);
	});

	it('gives a bay wider than a row its own row', () => {
		const layout = layoutGrids([
			grid({ id: 'wide', cells: { x: MAX_ROW_CELLS + 4, y: 2, z: 1 } }),
			grid({ id: 'small', cells: { x: 2, y: 2, z: 1 } })
		]);
		expect(layout.byId.get('small')?.origin.y).toBe(
			(layout.byId.get('wide')?.origin.y ?? 0) + 2 + ROW_GAP_CELLS
		);
	});

	it('exposes placements by id', () => {
		const layout = layoutGrids([grid({ id: 'only', cells: { x: 1, y: 1, z: 1 } })]);
		expect(layout.byId.get('only')?.grid.id).toBe('only');
		expect(layout.byId.get('missing')).toBeUndefined();
	});

	it('falls back to auto-layout when only some grids have offsets', () => {
		const layout = layoutGrids([
			grid({ id: 'a', cells: { x: 2, y: 2, z: 1 }, offset: { x: 10, y: 10, z: 0 } }),
			grid({ id: 'b', cells: { x: 2, y: 2, z: 1 } })
		]);
		expect(layout.curated).toBe(false);
		expect(layout.grids[0].origin.x).toBeLessThan(0);
	});
});

describe('layoutGrids (curated offsets)', () => {
	it('uses offsets verbatim and reports curated = true', () => {
		const layout = layoutGrids([
			grid({ id: 'main', cells: { x: 4, y: 8, z: 3 }, offset: { x: -2, y: -4, z: 0 } }),
			grid({ id: 'left', cells: { x: 2, y: 1, z: 2 }, offset: { x: -5, y: 1, z: 1 } })
		]);
		expect(layout.curated).toBe(true);
		expect(layout.grids[0].origin).toEqual({ x: -2, y: -4, z: 0 });
		expect(layout.grids[1].origin).toEqual({ x: -5, y: 1, z: 1 });
		expect(layout.min).toEqual({ x: -5, y: -4, z: 0 });
		expect(layout.max).toEqual({ x: 2, y: 4, z: 3 });
	});

	it('does not mutate the offset objects on the input grids', () => {
		const g = grid({ id: 'main', cells: { x: 1, y: 1, z: 1 }, offset: { x: 3, y: 3, z: 0 } });
		const layout = layoutGrids([g]);
		layout.grids[0].origin.x = 99;
		expect(g.offset).toEqual({ x: 3, y: 3, z: 0 });
	});
});
