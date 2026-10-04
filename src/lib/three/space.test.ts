import { describe, expect, it } from 'vitest';
import { CELL_M } from '../data/types.ts';
import {
	boundsCenter,
	boundsRadius,
	boundsSize,
	cellBoundsToWorld,
	cellBoxToWorld,
	cellSizeToWorld,
	cellToWorld,
	doorEdge
} from './space.ts';

describe('cellToWorld', () => {
	it('maps data x→x, z→y, y→-z and scales by CELL_M', () => {
		expect(cellToWorld({ x: 1, y: 2, z: 3 })).toEqual([1 * CELL_M, 3 * CELL_M, -2 * CELL_M]);
	});

	it('keeps the origin at the origin', () => {
		expect(cellToWorld({ x: 0, y: 0, z: 0 })).toEqual([0, 0, 0]);
	});

	it('accepts fractional cells', () => {
		expect(cellToWorld({ x: 0.5, y: 0, z: 0 })[0]).toBeCloseTo(0.625);
	});
});

describe('cellSizeToWorld', () => {
	it('swaps depth and height without changing sign', () => {
		expect(cellSizeToWorld({ x: 4, y: 6, z: 2 })).toEqual([5, 2.5, 7.5]);
	});
});

describe('cellBoxToWorld', () => {
	it('centres a unit box at its cell centre', () => {
		const box = cellBoxToWorld({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
		expect(box.center).toEqual([0.625, 0.625, -0.625]);
		expect(box.size).toEqual([CELL_M, CELL_M, CELL_M]);
	});

	it('places a 32-SCU box (8×2×2) lying along x', () => {
		const box = cellBoxToWorld({ x: 0, y: 2, z: 0 }, { x: 8, y: 2, z: 2 });
		expect(box.center).toEqual([5, 1.25, -3.75]);
		expect(box.size).toEqual([10, 2.5, 2.5]);
	});
});

describe('cellBoundsToWorld', () => {
	it('orders min/max after the depth axis flips', () => {
		const b = cellBoundsToWorld({ x: -2, y: 0, z: 0 }, { x: 2, y: 4, z: 3 });
		expect(b.min).toEqual([-2.5, 0, -5]);
		expect(b.max).toEqual([2.5, 3.75, 0]);
		expect(boundsCenter(b)).toEqual([0, 1.875, -2.5]);
		expect(boundsSize(b)).toEqual([5, 3.75, 5]);
		expect(boundsRadius(b)).toBeCloseTo(Math.hypot(5, 3.75, 5) / 2);
	});
});

describe('doorEdge', () => {
	const cells = { x: 4, y: 6, z: 2 };

	it("puts the '-y' door on the near edge (z = 0), arrows pointing to -z", () => {
		const e = doorEdge(cells, '-y');
		expect(e.center).toEqual([2.5, 0]);
		expect(e.length).toBe(5);
		expect(e.cells).toBe(4);
		expect(e.rotationY).toBe(0);
		expect(e.inward).toEqual([0, -1]);
	});

	it("puts the '+y' door on the far edge, rotated half a turn", () => {
		const e = doorEdge(cells, '+y');
		expect(e.center).toEqual([2.5, -7.5]);
		expect(e.rotationY).toBeCloseTo(Math.PI);
		expect(e.inward).toEqual([0, 1]);
	});

	it("runs the '-x' and '+x' doors along the depth axis", () => {
		const left = doorEdge(cells, '-x');
		expect(left.center).toEqual([0, -3.75]);
		expect(left.length).toBe(7.5);
		expect(left.cells).toBe(6);
		expect(left.inward).toEqual([1, 0]);
		const right = doorEdge(cells, '+x');
		expect(right.center).toEqual([5, -3.75]);
		expect(right.inward).toEqual([-1, 0]);
	});

	it('rotation maps the local -z arrow direction onto `inward` for every face', () => {
		for (const face of ['-y', '+y', '-x', '+x'] as const) {
			const e = doorEdge(cells, face);
			// Rotate the vector (0, 0, -1) about y by rotationY.
			const x = Math.sin(e.rotationY) * -1;
			const z = Math.cos(e.rotationY) * -1;
			expect(x).toBeCloseTo(e.inward[0]);
			expect(z).toBeCloseTo(e.inward[1]);
		}
	});
});
