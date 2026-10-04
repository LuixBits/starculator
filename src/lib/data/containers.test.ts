import { describe, expect, it } from 'vitest';
import {
	allowedSizesFor,
	containerMeters,
	fitsWithin,
	isUsableBox,
	maxContainerOf,
	sizesFittingGrid,
	sortedDims
} from './containers.ts';
import { CONTAINER_SIZES, type ContainerSize, type Vec3 } from './types.ts';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const ALL: ContainerSize[] = [1, 2, 4, 8, 16, 24, 32];

describe('container table', () => {
	it('matches the published footprints in metres (long axis first)', () => {
		expect(containerMeters(1)).toEqual(v(1.25, 1.25, 1.25));
		expect(containerMeters(2)).toEqual(v(2.5, 1.25, 1.25));
		expect(containerMeters(4)).toEqual(v(2.5, 2.5, 1.25));
		expect(containerMeters(8)).toEqual(v(2.5, 2.5, 2.5));
		expect(containerMeters(16)).toEqual(v(5, 2.5, 2.5));
		expect(containerMeters(24)).toEqual(v(7.5, 2.5, 2.5));
		expect(containerMeters(32)).toEqual(v(10, 2.5, 2.5));
	});

	it('every footprint holds its SCU in 1.25 m cells', () => {
		for (const size of CONTAINER_SIZES) {
			const m = containerMeters(size);
			expect((m.x * m.y * m.z) / 1.25 ** 3).toBeCloseTo(size, 9);
		}
	});
});

describe('sorted-dimension fitting', () => {
	it('sorts descending', () => {
		expect(sortedDims(v(2.5, 10, 2.5))).toEqual([10, 2.5, 2.5]);
	});

	it('ignores the axis frame: a 32 SCU box fits a limit given as 2.5×2.5×10', () => {
		expect(fitsWithin(containerMeters(32), v(2.5, 2.5, 10))).toBe(true);
		expect(fitsWithin(containerMeters(32), v(10, 2.5, 2.5))).toBe(true);
		expect(fitsWithin(containerMeters(32), v(2.5, 10, 2.5))).toBe(true);
	});

	it('rejects a box that is too long even if its volume fits', () => {
		// 5×5×2.5 limit holds 16 SCU of volume but a 16 SCU box is 5 m long and 2.5 m wide: fits;
		// a 24 SCU box (7.5 m) does not.
		expect(fitsWithin(containerMeters(16), v(5, 5, 2.5))).toBe(true);
		expect(fitsWithin(containerMeters(24), v(5, 5, 2.5))).toBe(false);
	});

	it('treats missing and zero limits as unusable', () => {
		expect(isUsableBox(null)).toBe(false);
		expect(isUsableBox(undefined)).toBe(false);
		expect(isUsableBox(v(0, 0, 0))).toBe(false);
		expect(isUsableBox(v(1.25, 1.25, 1.25))).toBe(true);
	});
});

describe('allowedSizesFor', () => {
	const unit = v(1.25, 1.25, 1.25);

	it('Hull C: MinSize = MaxSize = 2.5×10×2.5 → only 32 SCU', () => {
		expect(allowedSizesFor({ x: 8, y: 8, z: 6 }, v(2.5, 10, 2.5), v(2.5, 10, 2.5))).toEqual([32]);
	});

	it('Caterpillar module: MaxSize 2.5×7.5×2.5 → up to 24 SCU', () => {
		expect(allowedSizesFor({ x: 4, y: 6, z: 4 }, unit, v(2.5, 7.5, 2.5))).toEqual([
			1, 2, 4, 8, 16, 24
		]);
	});

	it('Caterpillar nose: MaxSize 5×5×2.5 → up to 16 SCU', () => {
		expect(allowedSizesFor({ x: 5, y: 4, z: 3 }, unit, v(5, 5, 2.5))).toEqual([1, 2, 4, 8, 16]);
	});

	it('Avenger Titan: MaxSize 2.5×2.5×1.25 → up to 4 SCU', () => {
		expect(allowedSizesFor({ x: 2, y: 4, z: 1 }, unit, v(2.5, 2.5, 1.25))).toEqual([1, 2, 4]);
	});

	it('Zeus Mk II CL main: MaxSize 2.5×2.5×10 (10 m on the Z axis) → up to 32 SCU', () => {
		expect(allowedSizesFor({ x: 5, y: 8, z: 3 }, unit, v(2.5, 2.5, 10))).toEqual(ALL);
	});

	it('Zeus Mk II CL side grid: 2×1×2 cells with MaxSize 2.5×2.5×1.25 → 1, 2, 4', () => {
		expect(allowedSizesFor({ x: 2, y: 1, z: 2 }, unit, v(2.5, 2.5, 1.25))).toEqual([1, 2, 4]);
	});

	it('C2 Hercules large deck: MaxSize 10×10×2.5 → everything', () => {
		expect(allowedSizesFor({ x: 8, y: 15, z: 4 }, unit, v(10, 10, 2.5))).toEqual(ALL);
	});

	it('missing MaxSize allows everything that fits the grid', () => {
		expect(allowedSizesFor({ x: 3, y: 4, z: 2 }, null, null)).toEqual([1, 2, 4, 8, 16]);
		expect(allowedSizesFor({ x: 1, y: 2, z: 1 }, null, null)).toEqual([1, 2]);
	});

	it('the grid itself limits even a generous MaxSize', () => {
		expect(allowedSizesFor({ x: 2, y: 2, z: 1 }, unit, v(10, 10, 10))).toEqual([1, 2, 4]);
		expect(sizesFittingGrid({ x: 1, y: 1, z: 1 })).toEqual([1]);
	});

	it('a MinSize larger than the smallest box excludes the small sizes', () => {
		expect(allowedSizesFor({ x: 4, y: 8, z: 2 }, v(2.5, 2.5, 2.5), null)).toEqual([8, 16, 24, 32]);
	});

	it('a 1 SCU MaxSize leaves only 1 SCU (the Ironclad data bug the overrides fix)', () => {
		expect(allowedSizesFor({ x: 6, y: 10, z: 6 }, unit, unit)).toEqual([1]);
	});
});

describe('maxContainerOf', () => {
	it('returns the largest size or null', () => {
		expect(maxContainerOf([1, 16, 4])).toBe(16);
		expect(maxContainerOf([])).toBeNull();
	});
});
