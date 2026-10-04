/**
 * Invariants over the committed generated data. Re-run the ingest when these
 * fail after a data update; they guard the contracts the UI and packer rely on.
 */

import { describe, expect, it } from 'vitest';
import { allowedSizesFor } from './containers.ts';
import indexJson from './generated/index.json';
import metaJson from './generated/meta.json';
import variantsJson from './generated/variants.json';
import overridesJson from './overrides.json';
import { parseOverrides } from './overrides.ts';
import { getAllSlugs, getMeta, getShipIndex, getVariants, loadShip, resolveSlug } from './ships.ts';
import { CELL_M, CONTAINER_SIZES, type DataMeta, type Ship, type ShipIndexEntry } from './types.ts';

const index = indexJson as ShipIndexEntry[];
const meta = metaJson as DataMeta;
const shipFiles = import.meta.glob<{ default: Ship }>('./generated/ships/*.json', { eager: true });
const ships: Ship[] = Object.values(shipFiles).map((m) => m.default);
const bySlug = new Map(ships.map((s) => [s.slug, s]));

function shipByClass(className: string): Ship {
	const ship = ships.find((s) => s.className === className);
	if (!ship) throw new Error(`${className} missing from generated data`);
	return ship;
}

describe('generated meta', () => {
	it('pins the scunpacked-data commit and game version', () => {
		expect(meta.source).toBe('scunpacked-data');
		expect(meta.repository).toBe('https://github.com/StarCitizenWiki/scunpacked-data');
		expect(meta.commit).toMatch(/^[0-9a-f]{40}$/);
		expect(meta.gameVersion).toMatch(/^\d+\.\d+/);
		expect(Number.isNaN(Date.parse(meta.publishedAt))).toBe(false);
		expect(Number.isNaN(Date.parse(meta.ingestedAt))).toBe(false);
	});

	it('counts match the files', () => {
		expect(meta.shipCount).toBe(ships.length);
		expect(meta.gridCount).toBe(ships.reduce((sum, s) => sum + s.grids.length, 0));
		expect(ships.length).toBeGreaterThanOrEqual(80);
	});
});

describe('generated ships', () => {
	it('every ship has at least one grid and the grid SCU sums to cargoScu', () => {
		for (const s of ships) {
			expect(s.grids.length, s.slug).toBeGreaterThan(0);
			expect(
				s.grids.reduce((sum, g) => sum + g.scu, 0),
				s.slug
			).toBe(s.cargoScu);
		}
	});

	it('all cells are positive integers consistent with metres and SCU', () => {
		for (const s of ships)
			for (const g of s.grids) {
				for (const axis of ['x', 'y', 'z'] as const) {
					expect(Number.isInteger(g.cells[axis]), `${s.slug}/${g.id}`).toBe(true);
					expect(g.cells[axis], `${s.slug}/${g.id}`).toBeGreaterThan(0);
					expect(g.meters[axis], `${s.slug}/${g.id}`).toBeCloseTo(g.cells[axis] * CELL_M, 9);
				}
				expect(g.cells.x * g.cells.y * g.cells.z, `${s.slug}/${g.id}`).toBe(g.scu);
			}
	});

	it('grid ids are unique per ship and allowed sizes are valid, sorted and non-empty', () => {
		for (const s of ships) {
			expect(new Set(s.grids.map((g) => g.id)).size, s.slug).toBe(s.grids.length);
			for (const g of s.grids) {
				expect(g.allowedSizes.length, `${s.slug}/${g.id}`).toBeGreaterThan(0);
				expect([...g.allowedSizes].sort((a, b) => a - b)).toEqual(g.allowedSizes);
				for (const size of g.allowedSizes) expect(CONTAINER_SIZES).toContain(size);
			}
			expect(s.maxContainer).toBe(Math.max(...s.grids.flatMap((g) => g.allowedSizes)));
		}
	});

	it('allowed sizes equal the container rule unless an override changed them', () => {
		const overridden = new Set(
			Object.entries(parseOverrides(overridesJson)).flatMap(([cls, o]) =>
				Object.entries(o.grids ?? {})
					.filter(([, patch]) => patch.allowedSizes)
					.map(([gridId]) => `${cls}/${gridId}`)
			)
		);
		for (const s of ships)
			for (const g of s.grids)
				if (!overridden.has(`${s.className}/${g.id}`))
					expect(g.allowedSizes, `${s.slug}/${g.id}`).toEqual(
						allowedSizesFor(g.cells, g.minBox, g.maxBox)
					);
	});

	it('representatives are not variants and list only known variant slugs', () => {
		const variantSlugs = new Set(variantsJson.map((v) => v.slug));
		for (const s of ships) {
			expect(s.variantOf).toBeNull();
			for (const v of s.variants) expect(variantSlugs.has(v), `${s.slug} → ${v}`).toBe(true);
		}
	});

	it('every override key names a ship in the data', () => {
		const classes = new Set(ships.map((s) => s.className));
		for (const [key, o] of Object.entries(parseOverrides(overridesJson)))
			if (o.grids) expect(classes.has(key), key).toBe(true);
	});
});

describe('generated index', () => {
	it('slugs are unique and match the ship files one to one', () => {
		const slugs = index.map((e) => e.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect([...slugs].sort()).toEqual([...bySlug.keys()].sort());
	});

	it('entries mirror their ship', () => {
		for (const e of index) {
			const s = bySlug.get(e.slug)!;
			expect(e).toEqual({
				slug: s.slug,
				name: s.name,
				fullName: s.fullName,
				manufacturer: s.manufacturer,
				size: s.size,
				role: s.role,
				cargoScu: s.cargoScu,
				gridCount: s.grids.length,
				maxContainer: s.maxContainer,
				isGroundVehicle: s.isGroundVehicle
			});
		}
	});

	it('is sorted by manufacturer then name', () => {
		const sorted = [...index].sort(
			(a, b) =>
				a.manufacturer.name.localeCompare(b.manufacturer.name, 'en') ||
				a.name.localeCompare(b.name, 'en', { numeric: true })
		);
		expect(index.map((e) => e.slug)).toEqual(sorted.map((e) => e.slug));
	});

	it('variants point at representatives and never collide with them', () => {
		const slugs = new Set(index.map((e) => e.slug));
		const variantSlugs = variantsJson.map((v) => v.slug);
		expect(new Set(variantSlugs).size).toBe(variantSlugs.length);
		for (const v of variantsJson) {
			expect(slugs.has(v.slug), v.slug).toBe(false);
			expect(slugs.has(v.variantOf), `${v.slug} → ${v.variantOf}`).toBe(true);
			expect(bySlug.get(v.variantOf)!.variants).toContain(v.slug);
		}
	});
});

describe('research expectations', () => {
	it('Drake Caterpillar: 14 grids, 576 SCU, four module bays of three grids plus the nose bay', () => {
		const cat = shipByClass('DRAK_Caterpillar');
		expect(cat.slug).toBe('drake-caterpillar');
		expect(cat.grids).toHaveLength(14);
		expect(cat.cargoScu).toBe(576);
		expect(cat.maxContainer).toBe(24);
		const bays = new Map<string | null, number>();
		for (const g of cat.grids) bays.set(g.bay, (bays.get(g.bay) ?? 0) + 1);
		expect([...bays.entries()].sort()).toEqual([
			['module-1', 3],
			['module-2', 3],
			['module-3', 3],
			['module-4', 3],
			['nose', 2]
		]);
		expect(cat.grids.find((g) => g.id === 'module-1')?.allowedSizes).toEqual([1, 2, 4, 8, 16, 24]);
		expect(cat.grids.find((g) => g.id === 'nose')?.allowedSizes).toEqual([1, 2, 4, 8, 16]);
		expect(cat.grids.find((g) => g.id === 'module-3')?.hardpoint).toBe(
			'hardpoint_cargogrid_module_03'
		);
		expect(cat.variants).toEqual(['drake-caterpillar-boarded', 'drake-caterpillar-pirate']);
	});

	it('MISC Hull C: 16 external grids, 4608 SCU, 32 SCU containers only', () => {
		const hull = shipByClass('MISC_Hull_C');
		expect(hull.cargoScu).toBe(4608);
		expect(hull.grids).toHaveLength(16);
		expect(hull.grids.filter((g) => g.scu === 384)).toHaveLength(8);
		expect(hull.grids.filter((g) => g.scu === 192)).toHaveLength(8);
		for (const g of hull.grids) {
			expect(g.allowedSizes).toEqual([32]);
			expect(g.external).toBe(true);
		}
		expect(hull.maxContainer).toBe(32);
	});

	it('RSI Zeus Mk II CL: main grid takes 32 SCU despite the 10 m being on the Z axis; side grids up to 4', () => {
		const zeus = shipByClass('RSI_Zeus_CL');
		expect(zeus.cargoScu).toBe(128);
		const byId = Object.fromEntries(zeus.grids.map((g) => [g.id, g]));
		expect(Object.keys(byId).sort()).toEqual(['left', 'main', 'right']);
		expect(byId.main.scu).toBe(120);
		expect(byId.main.maxBox).toEqual({ x: 2.5, y: 2.5, z: 10 });
		expect(byId.main.allowedSizes).toEqual([1, 2, 4, 8, 16, 24, 32]);
		expect(byId.left.allowedSizes).toEqual([1, 2, 4]);
		expect(byId.right.allowedSizes).toEqual([1, 2, 4]);
	});

	it('Crusader C2 Hercules: 480 + 216 = 696 SCU, up to 32 SCU boxes', () => {
		const c2 = shipByClass('CRUS_Starlifter_C2');
		expect(c2.cargoScu).toBe(696);
		expect(c2.grids.map((g) => g.scu).sort((a, b) => a - b)).toEqual([216, 480]);
		expect(c2.grids.find((g) => g.scu === 480)?.cells).toEqual({ x: 8, y: 15, z: 4 });
		expect(c2.maxContainer).toBe(32);
	});

	it('overrides from the research are in effect', () => {
		const ironclad = shipByClass('DRAK_Ironclad');
		for (const id of ['hold-1', 'hold-2', 'hold-1-center', 'hold-2-center'])
			expect(ironclad.grids.find((g) => g.id === id)?.allowedSizes).toEqual([
				1, 2, 4, 8, 16, 24, 32
			]);
		expect(ironclad.maxContainer).toBe(32);
		expect(shipByClass('CNOU_Nomad').grids[0].allowedSizes).toEqual([1, 2, 4, 8]);
		expect(
			shipByClass('DRAK_Cutlass_Black').grids.find((g) => g.id === 'main')?.allowedSizes
		).toEqual([1, 2, 4, 8]);
		expect(shipByClass('AEGS_Avenger_Titan').grids[0].allowedSizes).toEqual([1, 2, 4]);
	});

	it('ground vehicles are flagged', () => {
		expect(shipByClass('TMBL_Cyclone').isGroundVehicle).toBe(true);
		expect(shipByClass('DRAK_Caterpillar').isGroundVehicle).toBe(false);
	});
});

describe('ships.ts loader', () => {
	it('exposes index, meta, slugs and variants', () => {
		expect(getShipIndex()).toEqual(index);
		expect(getMeta()).toEqual(meta);
		expect(getAllSlugs()).toEqual(index.map((e) => e.slug));
		expect(getVariants()).toEqual(variantsJson);
	});

	it('loads a ship lazily and returns null for unknown slugs', async () => {
		const cat = await loadShip('drake-caterpillar');
		expect(cat?.className).toBe('DRAK_Caterpillar');
		expect(await loadShip('does-not-exist')).toBeNull();
		expect(await loadShip('../index')).toBeNull();
	});

	it('resolves variant slugs to their representative', () => {
		expect(resolveSlug('drake-caterpillar')).toBe('drake-caterpillar');
		expect(resolveSlug('drake-caterpillar-pirate')).toBe('drake-caterpillar');
		expect(resolveSlug('nope')).toBeNull();
	});
});
