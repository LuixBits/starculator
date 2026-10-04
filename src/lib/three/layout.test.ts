import { describe, expect, it } from 'vitest';
import { BAY_GAP_CELLS, GRID_GAP_CELLS, layoutGrids } from './layout.ts';
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
