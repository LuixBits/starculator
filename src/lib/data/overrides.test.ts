import { describe, expect, it } from 'vitest';
import overridesJson from './overrides.json';
import {
	OverrideError,
	applyOverride,
	applyOverrides,
	hiddenClassNames,
	parseOverrides
} from './overrides.ts';
import type { CargoGrid, Ship } from './types.ts';

function grid(id: string, partial: Partial<CargoGrid> = {}): CargoGrid {
	return {
		id,
		name: id,
		className: `TEST_CargoGrid_${id}`,
		cells: { x: 4, y: 8, z: 2 },
		meters: { x: 5, y: 10, z: 2.5 },
		scu: 64,
		minBox: null,
		maxBox: null,
		allowedSizes: [1, 2],
		external: false,
		hardpoint: null,
		bay: null,
		offset: null,
		door: null,
		...partial
	};
}

function ship(grids: CargoGrid[], className = 'TEST_Ship'): Ship {
	return {
		slug: 'test-ship',
		name: 'Ship',
		fullName: 'Test Ship',
		className,
		uuid: 'u',
		manufacturer: { code: 'TEST', name: 'Test' },
		size: 'Medium',
		role: null,
		career: null,
		dimensions: { x: 1, y: 2, z: 3 },
		cargoScu: grids.reduce((sum, g) => sum + g.scu, 0),
		grids,
		maxContainer: 2,
		isSpaceship: true,
		isGroundVehicle: false,
		variantOf: null,
		variants: []
	};
}

describe('parseOverrides', () => {
	it('accepts the committed overrides.json', () => {
		const parsed = parseOverrides(overridesJson);
		expect(Object.keys(parsed).length).toBeGreaterThan(0);
		for (const entry of Object.values(parsed)) expect(entry.note.length).toBeGreaterThan(10);
	});

	it('requires a note', () => {
		expect(() => parseOverrides({ X: { grids: {} } })).toThrow(OverrideError);
		expect(() => parseOverrides({ X: { note: '   ' } })).toThrow(/note/);
	});

	it('rejects unknown fields and bad values', () => {
		expect(() => parseOverrides({ X: { note: 'n', bogus: 1 } })).toThrow(/bogus/);
		expect(() => parseOverrides({ X: { note: 'n', grids: { a: { allowedSizes: [3] } } } })).toThrow(
			/allowedSizes/
		);
		expect(() => parseOverrides({ X: { note: 'n', grids: { a: { door: 'up' } } } })).toThrow(
			/door/
		);
		expect(() =>
			parseOverrides({ X: { note: 'n', grids: { a: { offset: { x: 1.5, y: 0, z: 0 } } } } })
		).toThrow(/offset/);
		expect(() => parseOverrides({ X: { note: 'n', hide: 'yes' } })).toThrow(/hide/);
	});

	it('normalises allowedSizes to a sorted unique list', () => {
		const parsed = parseOverrides({
			X: { note: 'n', grids: { a: { allowedSizes: [8, 1, 8, 2] } } }
		});
		expect(parsed.X.grids?.a.allowedSizes).toEqual([1, 2, 8]);
	});
});

describe('applyOverride', () => {
	it('patches name, sizes, bay, offset and door and recomputes maxContainer', () => {
		const s = ship([grid('main'), grid('rear', { allowedSizes: [1] })]);
		const out = applyOverride(s, {
			note: 'test',
			grids: {
				main: {
					name: 'Main deck',
					allowedSizes: [1, 2, 4, 8, 16, 24, 32],
					bay: 'deck',
					offset: { x: 0, y: 1, z: 0 },
					door: '-y'
				}
			}
		});
		expect(out.grids[0]).toMatchObject({
			id: 'main',
			name: 'Main deck',
			allowedSizes: [1, 2, 4, 8, 16, 24, 32],
			bay: 'deck',
			offset: { x: 0, y: 1, z: 0 },
			door: '-y'
		});
		expect(out.grids[1]).toEqual(s.grids[1]);
		expect(out.maxContainer).toBe(32);
		expect(s.grids[0].name).toBe('main'); // input untouched
	});

	it('rejects unknown grid ids', () => {
		expect(() =>
			applyOverride(ship([grid('main')]), { note: 'n', grids: { nope: { name: 'x' } } })
		).toThrow(/no grid "nope"/);
	});

	it('rejects sizes that cannot fit the grid geometry', () => {
		const small = ship([grid('main', { cells: { x: 2, y: 2, z: 1 }, scu: 4 })]);
		expect(() =>
			applyOverride(small, { note: 'n', grids: { main: { allowedSizes: [8] } } })
		).toThrow(/8 SCU does not fit/);
	});
});

describe('applyOverrides over a ship list', () => {
	const ships = [ship([grid('main')], 'A'), ship([grid('main')], 'B')];

	it('applies to matching representatives and reports them', () => {
		const { ships: out, applied } = applyOverrides(ships, {
			B: { note: 'n', grids: { main: { allowedSizes: [1, 2, 4] } } }
		});
		expect(applied).toEqual(['B']);
		expect(out[0].grids[0].allowedSizes).toEqual([1, 2]);
		expect(out[1].grids[0].allowedSizes).toEqual([1, 2, 4]);
	});

	it('tolerates hide-only keys for vehicles that are no longer in the list', () => {
		const { applied } = applyOverrides(ships, { Gone: { note: 'n', hide: true } });
		expect(applied).toEqual([]);
		expect(hiddenClassNames({ Gone: { note: 'n', hide: true }, A: { note: 'n' } })).toEqual(
			new Set(['Gone'])
		);
	});

	it('fails loudly on a grid override whose ship does not exist', () => {
		expect(() =>
			applyOverrides(ships, { Gone: { note: 'n', grids: { main: { name: 'x' } } } })
		).toThrow(/matches no representative/);
	});
});
