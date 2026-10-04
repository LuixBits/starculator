import { describe, expect, it } from 'vitest';
import { CELL_M, CONTAINER_CELLS, CONTAINER_SIZES } from '../data/types.ts';
import type { CellVec } from '../data/types.ts';
import {
	DEFAULT_DOOR,
	cellsToMeters,
	containerOrientations,
	depthFromDoor,
	doorOf,
	isCanonicalDims,
	maxDepth,
	metersToCells,
	orientationsOf,
	sameCells,
	scuOfDims
} from './geometry.ts';
import { createRng, shuffle } from './random.ts';
import { Lattice } from './lattice.ts';
import { c2, titan } from './fixtures.ts';

describe('orientations', () => {
	it('lists each distinct axis permutation once, canonical first', () => {
		const expected: Record<number, number> = { 1: 1, 2: 3, 4: 3, 8: 1, 16: 3, 24: 3, 32: 3 };
		for (const scu of CONTAINER_SIZES) {
			const list = orientationsOf(CONTAINER_CELLS[scu]);
			expect(list).toHaveLength(expected[scu]);
			expect(sameCells(list[0], CONTAINER_CELLS[scu])).toBe(true);
			const keys = new Set(list.map((o) => `${o.x},${o.y},${o.z}`));
			expect(keys.size).toBe(list.length);
			for (const o of list) expect(scuOfDims(o)).toBe(scu);
		}
	});

	it('returns only the canonical shape when rotation is off', () => {
		expect(containerOrientations(32, false)).toEqual([{ x: 8, y: 2, z: 2 }]);
		expect(containerOrientations(32, true)).toHaveLength(3);
		// cached instances are stable
		expect(containerOrientations(16)).toBe(containerOrientations(16));
	});

	it('recognises container shapes and rejects others', () => {
		expect(scuOfDims({ x: 2, y: 2, z: 4 })).toBe(16);
		expect(scuOfDims({ x: 1, y: 1, z: 2 })).toBe(2);
		expect(scuOfDims({ x: 3, y: 1, z: 1 })).toBeNull();
		expect(scuOfDims({ x: 4, y: 4, z: 1 })).toBeNull();
		expect(scuOfDims({ x: 2, y: 2, z: 3 })).toBeNull();
		expect(isCanonicalDims({ x: 8, y: 2, z: 2 })).toBe(true);
		expect(isCanonicalDims({ x: 2, y: 8, z: 2 })).toBe(false);
	});
});

describe('units', () => {
	it('round-trips cells and metres for real grids', () => {
		for (const grid of [...titan, ...c2]) {
			expect(cellsToMeters(grid.cells)).toEqual(grid.meters);
			expect(metersToCells(grid.meters)).toEqual(grid.cells);
		}
		expect(metersToCells({ x: 6.25, y: 5, z: 3.75 })).toEqual({ x: 5, y: 4, z: 3 });
		expect(cellsToMeters({ x: 1, y: 1, z: 1 })).toEqual({ x: CELL_M, y: CELL_M, z: CELL_M });
	});
});

describe('door and depth', () => {
	const cells: CellVec = { x: 4, y: 5, z: 2 };
	const dims: CellVec = { x: 2, y: 1, z: 1 };

	it('defaults to the -y face', () => {
		expect(DEFAULT_DOOR).toBe('-y');
		expect(doorOf({ door: null })).toBe('-y');
		expect(doorOf({ door: '+x' })).toBe('+x');
	});

	it('measures depth from the door face to the nearest box face', () => {
		const at: CellVec = { x: 1, y: 3, z: 0 };
		expect(depthFromDoor(cells, '-y', at, dims)).toBe(3);
		expect(depthFromDoor(cells, '+y', at, dims)).toBe(1);
		expect(depthFromDoor(cells, '-x', at, dims)).toBe(1);
		expect(depthFromDoor(cells, '+x', at, dims)).toBe(1);
		expect(maxDepth(cells, '-y', dims)).toBe(4);
		expect(maxDepth(cells, '+x', dims)).toBe(2);
	});
});

describe('lattice', () => {
	it('tracks occupancy, support and contact', () => {
		const lat = new Lattice({ x: 2, y: 2, z: 2 });
		expect(lat.total).toBe(8);
		lat.fill({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }, 1);
		expect(lat.used).toBe(2);
		expect(lat.isFree({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBe(false);
		expect(lat.isFree({ x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 1 })).toBe(true);
		expect(lat.supportCount({ x: 0, y: 0, z: 1 }, { x: 2, y: 2, z: 1 })).toBe(2);
		expect(lat.supportFraction({ x: 0, y: 0, z: 1 }, { x: 2, y: 2, z: 1 })).toBe(0.5);
		// box at (0,1,0) 2x1x1: -x wall 1, +x wall 1, -y neighbour 2, +y wall 2 = 6
		expect(lat.sideContact({ x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 1 })).toBe(6);
		expect(lat.maxHeight()).toBe(1);
		lat.fill({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 1 }, 0);
		expect(lat.used).toBe(0);
		expect(lat.maxHeight()).toBe(0);
		const clone = lat.clone();
		clone.fill({ x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }, 1);
		expect(lat.used).toBe(0);
		expect(clone.used).toBe(1);
	});
});

describe('seeded random', () => {
	it('is deterministic and in [0, 1)', () => {
		const a = createRng(42);
		const b = createRng(42);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
		expect(createRng(1)()).not.toBe(createRng(2)());
		expect(shuffle([1, 2, 3, 4, 5], createRng(7))).toEqual(shuffle([1, 2, 3, 4, 5], createRng(7)));
	});
});
