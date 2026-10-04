import { describe, expect, it } from 'vitest';
import {
	humanize,
	kebab,
	sizeLabel,
	slugify,
	splitGridClass,
	stripManufacturer,
	variantScore
} from '../../../scripts/ingest/naming.ts';
import {
	IngestError,
	matchHardpoints,
	normalizeVehicle,
	positionWords
} from '../../../scripts/ingest/normalize.ts';
import type { RawCargoGrid, RawPort, RawVehicle } from '../../../scripts/ingest/raw.ts';
import { shipWords } from '../../../scripts/ingest/naming.ts';
import { assignSlugs, disambiguateNames, foldVariants } from '../../../scripts/ingest/variants.ts';

/* ---------- inline raw sample: Drake Caterpillar (4.10.1) ---------- */

const box = (X: number, Y: number, Z: number) => ({ X, Y, Z });
const unit = box(1.25, 1.25, 1.25);

function grid(
	suffix: string,
	[X, Y, Z]: [number, number, number],
	SCU: number,
	max: { X: number; Y: number; Z: number }
): RawCargoGrid {
	return {
		Class: `DRAK_Caterpillar_CargoInventory_${suffix}`,
		SCU,
		X,
		Y,
		Z,
		MinSize: unit,
		MaxSize: max,
		IsOpenContainer: true,
		IsExternalContainer: true,
		IsClosedContainer: false
	};
}

function port(hardpoint: string, suffix: string): RawPort {
	return { HardpointName: hardpoint, ClassName: `DRAK_Caterpillar_CargoGrid_${suffix}` };
}

const moduleTriple = (): RawCargoGrid[] => [
	grid('Module', [5, 7.5, 5], 96, box(2.5, 7.5, 2.5)),
	grid('Module_Walkway', [5, 1.25, 2.5], 8, box(2.5, 1.25, 1.25)),
	grid('Module_Ladder', [1.25, 6.25, 5], 20, box(1.25, 2.5, 1.25))
];

// Ports deliberately in the order the game data lists them: not aligned with CargoGrids.
const caterpillarPorts: RawPort[] = [
	port('hardpoint_cargogrid_module_04', 'Module'),
	port('hardpoint_cargogrid_module_04_walkway', 'Module_Walkway'),
	port('hardpoint_cargogrid_module_04_ladder', 'Module_Ladder'),
	port('hardpoint_cargogrid_nose', 'Nose'),
	port('hardpoint_cargogrid_module_01', 'Module'),
	port('hardpoint_cargogrid_module_02', 'Module'),
	port('hardpoint_cargogrid_module_03', 'Module'),
	port('hardpoint_cargogrid_nose_access', 'Nose_Access'),
	port('hardpoint_cargogrid_module_03_walkway', 'Module_Walkway'),
	port('hardpoint_cargogrid_module_02_walkway', 'Module_Walkway'),
	port('hardpoint_cargogrid_module_01_walkway', 'Module_Walkway'),
	port('hardpoint_cargogrid_module_03_ladder', 'Module_Ladder'),
	port('hardpoint_cargogrid_module_02_ladder', 'Module_Ladder'),
	port('hardpoint_cargogrid_module_01_ladder', 'Module_Ladder')
];

function caterpillar(overrides: Partial<RawVehicle> = {}): RawVehicle {
	return {
		UUID: 'dc39ca6b-1d76-4db5-9346-356f49954978',
		ClassName: 'DRAK_Caterpillar',
		Name: 'Drake Caterpillar',
		Manufacturer: { Code: 'DRAK', Name: 'Drake Interplanetary' },
		Size: 5,
		Role: 'Medium Freight',
		Career: 'Transporter',
		Length: 111.5,
		Width: 39.5,
		Height: 13.4,
		Cargo: 576,
		IsSpaceship: true,
		IsVehicle: false,
		IsGravlev: false,
		CargoGrids: [
			grid('Nose', [6.25, 5, 3.75], 60, box(5, 5, 2.5)),
			grid('Nose_Access', [6.25, 2.5, 2.5], 20, box(5, 2.5, 2.5)),
			...moduleTriple(),
			...moduleTriple(),
			...moduleTriple(),
			...moduleTriple()
		],
		Systems: { CargoGrids: { Ports: caterpillarPorts } },
		...overrides
	};
}

describe('normalizeVehicle on the Caterpillar sample', () => {
	const { ship, warnings } = normalizeVehicle(caterpillar());

	it('produces the ship header', () => {
		expect(ship.slug).toBe('drake-caterpillar');
		expect(ship.name).toBe('Caterpillar');
		expect(ship.fullName).toBe('Drake Caterpillar');
		expect(ship.manufacturer).toEqual({ code: 'DRAK', name: 'Drake Interplanetary' });
		expect(ship.size).toBe('Extra large');
		expect(ship.dimensions).toEqual({ x: 39.5, y: 111.5, z: 13.4 });
		expect(ship.cargoScu).toBe(576);
		expect(ship.isSpaceship).toBe(true);
		expect(ship.isGroundVehicle).toBe(false);
		expect(ship.maxContainer).toBe(24);
		expect(warnings).toEqual([]);
	});

	it('has 14 grids summing to 576 SCU with integral cells', () => {
		expect(ship.grids).toHaveLength(14);
		expect(ship.grids.reduce((sum, g) => sum + g.scu, 0)).toBe(576);
		for (const g of ship.grids) {
			expect(g.cells.x * g.cells.y * g.cells.z).toBe(g.scu);
			expect(g.meters).toEqual({ x: g.cells.x * 1.25, y: g.cells.y * 1.25, z: g.cells.z * 1.25 });
			expect(g.external).toBe(true);
			expect(g.offset).toBeNull();
			expect(g.door).toBeNull();
		}
	});

	it('groups module + walkway + ladder into bays module-1 … module-4 plus a nose bay', () => {
		const byBay = new Map<string | null, string[]>();
		for (const g of ship.grids) byBay.set(g.bay, [...(byBay.get(g.bay) ?? []), g.id]);
		expect([...byBay.keys()].sort()).toEqual([
			'module-1',
			'module-2',
			'module-3',
			'module-4',
			'nose'
		]);
		expect(byBay.get('nose')).toEqual(['nose', 'nose-access']);
		for (const n of [1, 2, 3, 4])
			expect(byBay.get(`module-${n}`)).toEqual([
				`module-${n}`,
				`module-${n}-walkway`,
				`module-${n}-ladder`
			]);
	});

	it('humanises names', () => {
		const names = Object.fromEntries(ship.grids.map((g) => [g.id, g.name]));
		expect(names['nose']).toBe('Nose');
		expect(names['nose-access']).toBe('Nose access');
		expect(names['module-1']).toBe('Module 1');
		expect(names['module-1-walkway']).toBe('Module 1 walkway');
		expect(names['module-4-ladder']).toBe('Module 4 ladder');
	});

	it('matches hardpoints by family even though port order differs from grid order', () => {
		const hp = Object.fromEntries(ship.grids.map((g) => [g.id, g.hardpoint]));
		expect(hp['nose']).toBe('hardpoint_cargogrid_nose');
		expect(hp['nose-access']).toBe('hardpoint_cargogrid_nose_access');
		for (const n of [1, 2, 3, 4]) {
			expect(hp[`module-${n}`]).toBe(`hardpoint_cargogrid_module_0${n}`);
			expect(hp[`module-${n}-walkway`]).toBe(`hardpoint_cargogrid_module_0${n}_walkway`);
			expect(hp[`module-${n}-ladder`]).toBe(`hardpoint_cargogrid_module_0${n}_ladder`);
		}
	});

	it('derives allowed sizes from MaxSize with the correct box table', () => {
		const sizes = Object.fromEntries(ship.grids.map((g) => [g.id, g.allowedSizes]));
		expect(sizes['module-1']).toEqual([1, 2, 4, 8, 16, 24]);
		expect(sizes['nose']).toEqual([1, 2, 4, 8, 16]);
		expect(sizes['nose-access']).toEqual([1, 2, 4, 8, 16]);
		expect(sizes['module-1-walkway']).toEqual([1, 2]);
		expect(sizes['module-1-ladder']).toEqual([1, 2]);
	});

	it('keeps the published class names and limits', () => {
		const nose = ship.grids[0];
		expect(nose.className).toBe('DRAK_Caterpillar_CargoInventory_Nose');
		expect(nose.minBox).toEqual({ x: 1.25, y: 1.25, z: 1.25 });
		expect(nose.maxBox).toEqual({ x: 5, y: 5, z: 2.5 });
	});
});

describe('normalizeVehicle validation', () => {
	it('fails when the grid sum does not match Cargo', () => {
		expect(() => normalizeVehicle(caterpillar({ Cargo: 500 }))).toThrow(IngestError);
		expect(() => normalizeVehicle(caterpillar({ Cargo: 500 }))).toThrow(
			/grid SCU sum 576 ≠ Cargo 500/
		);
	});

	it('fails when a grid dimension is not a multiple of 1.25 m', () => {
		const raw = caterpillar();
		raw.CargoGrids![0].X = 6;
		expect(() => normalizeVehicle(raw)).toThrow(/not a multiple of 1.25 m/);
	});

	it('warns instead of failing on missing MaxSize and unmatched hardpoints', () => {
		const { ship, warnings } = normalizeVehicle({
			...caterpillar(),
			ClassName: 'CNOU_Nomad',
			Name: 'C.O. Nomad',
			Manufacturer: { Code: 'CNOU', Name: 'Consolidated Outland' },
			Cargo: 24,
			CargoGrids: [{ Class: 'CNOU_Nomad_CargoGrid', SCU: 24, X: 3.75, Y: 5, Z: 2.5 }],
			Systems: null
		});
		expect(ship.slug).toBe('co-nomad');
		expect(ship.name).toBe('Nomad');
		expect(ship.grids[0].id).toBe('main');
		expect(ship.grids[0].allowedSizes).toEqual([1, 2, 4, 8, 16]);
		expect(ship.grids[0].hardpoint).toBeNull();
		expect(ship.grids[0].minBox).toBeNull();
		expect(warnings).toHaveLength(2);
	});
});

describe('matchHardpoints fallbacks', () => {
	it('pairs leftover families by unique count when names differ', () => {
		const grids: RawCargoGrid[] = [
			{ Class: 'GAMA_Railen_CargoGrid_IS_64', SCU: 64, X: 5, Y: 10, Z: 2.5 },
			{ Class: 'GAMA_Railen_CargoGrid_IS_64', SCU: 64, X: 5, Y: 10, Z: 2.5 },
			{ Class: 'GAMA_Railen_CargoGrid_IS_128', SCU: 128, X: 5, Y: 10, Z: 5 }
		];
		const ports: RawPort[] = [
			{ HardpointName: 'hardpoint_cargo_left_top', ClassName: 'GAMA_Railen_CargoGrid_Large' },
			{ HardpointName: 'hardpoint_cargo_right_side', ClassName: 'GAMA_Railen_CargoGrid_Small' },
			{ HardpointName: 'hardpoint_cargo_left_side', ClassName: 'GAMA_Railen_CargoGrid_Small' }
		];
		expect(matchHardpoints(grids, ports)).toEqual([
			'hardpoint_cargo_left_side',
			'hardpoint_cargo_right_side',
			'hardpoint_cargo_left_top'
		]);
	});

	it('leaves ambiguous families unmatched', () => {
		const grids: RawCargoGrid[] = [
			{ Class: 'X_CargoGrid_A', SCU: 1, X: 1.25, Y: 1.25, Z: 1.25 },
			{ Class: 'X_CargoGrid_B', SCU: 1, X: 1.25, Y: 1.25, Z: 1.25 }
		];
		const ports: RawPort[] = [
			{ HardpointName: 'hp_1', ClassName: 'X_CargoGrid_C' },
			{ HardpointName: 'hp_2', ClassName: 'X_CargoGrid_D' }
		];
		expect(matchHardpoints(grids, ports)).toEqual([null, null]);
	});
});

describe('naming helpers', () => {
	it('splits at the CargoGrid / CargoInventory / CargoGridIC marker', () => {
		expect(splitGridClass('DRAK_Caterpillar_CargoInventory_Module_Walkway').after).toEqual([
			'Module',
			'Walkway'
		]);
		expect(splitGridClass('ARGO_RAFT_CargoGridIC_192').after).toEqual(['192']);
		expect(splitGridClass('MISC_Hull_C_CargoGrid').after).toEqual([]);
	});

	it('humanises and kebabs tokens', () => {
		expect(humanize(['Nose', 'Access'])).toBe('Nose access');
		expect(humanize(['SecureHold', 'Center'])).toBe('Secure hold center');
		expect(humanize(['KORE'])).toBe('Kore');
		expect(humanize(['MAX'])).toBe('MAX');
		expect(kebab(['SecureHold', 'Center'])).toBe('secure-hold-center');
	});

	it('slugifies and strips manufacturers', () => {
		expect(slugify("Grey's Shiv")).toBe('greys-shiv');
		expect(slugify('C.O. Nomad')).toBe('co-nomad');
		expect(slugify('Aegis Idris-P')).toBe('aegis-idris-p');
		expect(
			stripManufacturer('MISC Hull C', {
				code: 'MISC',
				name: 'Musashi Industrial and Starflight Concern'
			})
		).toBe('Hull C');
		expect(stripManufacturer('C.O. Nomad', { code: 'CNOU', name: 'Consolidated Outland' })).toBe(
			'Nomad'
		);
		expect(
			stripManufacturer('Cutlass Black PYAM Exec', { code: 'DRAK', name: 'Drake Interplanetary' })
		).toBe('Cutlass Black PYAM Exec');
	});

	it('scores variant suffixes and labels sizes', () => {
		expect(variantScore('DRAK_Caterpillar')).toBe(0);
		expect(variantScore('DRAK_Caterpillar_Pirate')).toBe(1);
		expect(variantScore('RSI_Polaris_Collector_Military')).toBe(2);
		expect(sizeLabel(3)).toBe('Medium');
		expect(sizeLabel(6)).toBe('Capital');
		expect(sizeLabel(42)).toBe('42');
	});
});

describe('slugs and variant folding', () => {
	const base = normalizeVehicle(caterpillar()).ship;
	const pirate = normalizeVehicle(
		caterpillar({
			ClassName: 'DRAK_Caterpillar_Pirate',
			Name: 'Drake Caterpillar Pirate',
			UUID: 'p'
		})
	).ship;
	const boarded = normalizeVehicle(
		caterpillar({ ClassName: 'DRAK_Caterpillar_Boarded', UUID: 'b' })
	).ship;
	const other = normalizeVehicle(
		caterpillar({
			ClassName: 'DRAK_Caterpillar_Stretch',
			Name: 'Drake Caterpillar Stretch',
			UUID: 's',
			Cargo: 596,
			CargoGrids: [...caterpillar().CargoGrids!, grid('Extra', [2.5, 5, 2.5], 20, box(2.5, 5, 2.5))]
		})
	).ship;

	it('gives colliding names unique slugs using class tokens', () => {
		const slugs = assignSlugs([pirate, boarded, base]).map((s) => `${s.className}=${s.slug}`);
		// base hull first, then shorter class names (Pirate before Boarded)
		expect(slugs).toEqual([
			'DRAK_Caterpillar=drake-caterpillar',
			'DRAK_Caterpillar_Pirate=drake-caterpillar-pirate',
			'DRAK_Caterpillar_Boarded=drake-caterpillar-boarded'
		]);
	});

	it('folds identical grid sets under the base hull and keeps different ones apart', () => {
		const { representatives, variants } = foldVariants(assignSlugs([pirate, other, boarded, base]));
		expect(representatives.map((r) => r.slug)).toEqual([
			'drake-caterpillar',
			'drake-caterpillar-stretch'
		]);
		expect(representatives[0].variants).toEqual([
			'drake-caterpillar-boarded',
			'drake-caterpillar-pirate'
		]);
		expect(representatives[0].variantOf).toBeNull();
		expect(variants.map((v) => `${v.slug}->${v.variantOf}`)).toEqual([
			'drake-caterpillar-boarded->drake-caterpillar',
			'drake-caterpillar-pirate->drake-caterpillar'
		]);
	});
});

/* ---------- position words from hardpoints ---------- */

const MAKERS: Readonly<Record<string, string>> = {
	DRAK: 'Drake Interplanetary',
	MISC: 'Musashi Industrial and Starflight Concern',
	RSI: 'Roberts Space Industries',
	ANVL: 'Anvil Aerospace',
	AEGS: 'Aegis Dynamics'
};

function simpleShip(
	className: string,
	name: string,
	gridClass: string,
	hardpoints: readonly string[],
	dims: [number, number, number] = [2.5, 10, 2.5],
	overrides: Partial<RawVehicle> = {}
): RawVehicle {
	const [X, Y, Z] = dims;
	const scu = (X / 1.25) * (Y / 1.25) * (Z / 1.25);
	const code = className.split('_')[0];
	return {
		UUID: className,
		ClassName: className,
		Name: name,
		Manufacturer: { Code: code, Name: MAKERS[code] ?? 'Maker' },
		Length: 50,
		Width: 20,
		Height: 10,
		Cargo: scu * hardpoints.length,
		IsSpaceship: true,
		CargoGrids: hardpoints.map(() => ({ Class: gridClass, SCU: scu, X, Y, Z })),
		Systems: {
			CargoGrids: {
				Ports: hardpoints.map((h) => ({ HardpointName: h, ClassName: `${gridClass}_Port` }))
			}
		},
		...overrides
	};
}

describe('grid labels from hardpoint positions', () => {
	it('Hull B: sixteen identical grids named by position, stacked racks share a bay', () => {
		const sides = ['bottom', 'top'].flatMap((v) =>
			['front', 'rear'].flatMap((f) =>
				['left', 'right'].flatMap((s) =>
					['lower', 'upper'].map((l) => `hardpoint_cargogrid_${v}_${f}_${s}_${l}`)
				)
			)
		);
		const { ship } = normalizeVehicle(
			simpleShip('MISC_Hull_B', 'MISC Hull B', 'MISC_Hull_B_CargoGrid', sides)
		);
		expect(ship.grids.map((g) => g.id)).toEqual(
			sides.map((h) => h.replace('hardpoint_cargogrid_', '').replaceAll('_', '-'))
		);
		expect(ship.grids[0].name).toBe('Bottom front left lower');
		expect(ship.grids[0].bay).toBe('bottom-front-left');
		expect(ship.grids[1].bay).toBe('bottom-front-left');
		expect(new Set(ship.grids.map((g) => g.bay)).size).toBe(8);
	});

	it('Carrack: words every hardpoint of a class shares are dropped, class tokens kept', () => {
		const large = ['front', 'mid', 'rear'].flatMap((f) => [
			`hardpoint_cargo_${f}_left`,
			`hardpoint_cargo_${f}_right`
		]);
		const medium = ['front', 'mid', 'rear'].map((f) => `hardpoint_cargo_${f}_mid`);
		const raw = simpleShip('ANVL_Carrack', 'Anvil Carrack', 'ANVL_Carrack_CargoGrid_Large', large);
		raw.CargoGrids!.push(
			...medium.map(() => ({
				Class: 'ANVL_Carrack_CargoGrid_Medium',
				SCU: 8,
				X: 2.5,
				Y: 5,
				Z: 1.25
			}))
		);
		raw.Systems!.CargoGrids!.Ports!.push(
			...medium.map((h) => ({ HardpointName: h, ClassName: 'ANVL_Carrack_CargoGrid_Medium' }))
		);
		raw.Cargo = raw.CargoGrids!.reduce((sum, g) => sum + g.SCU, 0);
		const { ship } = normalizeVehicle(raw);
		const names = ship.grids.map((g) => g.name);
		expect(names.slice(0, 6)).toEqual([
			'Large front left',
			'Large front right',
			'Large mid left',
			'Large mid right',
			'Large rear left',
			'Large rear right'
		]);
		expect(names.slice(6)).toEqual(['Medium front', 'Medium mid', 'Medium rear']);
	});

	it('Starlancer MAX: the edition token stays on the second family, l/r are expanded', () => {
		const raw = simpleShip(
			'MISC_Starlancer_Max',
			'MISC Starlancer MAX',
			'MISC_Starlancer_CargoGrid_Template',
			['hardpoint_cargogrid_left', 'hardpoint_cargogrid_right'],
			[2.5, 10, 3.75]
		);
		raw.CargoGrids!.push(
			{ Class: 'MISC_Starlancer_CargoGrid_Max_Template', SCU: 64, X: 2.5, Y: 20, Z: 2.5 },
			{ Class: 'MISC_Starlancer_CargoGrid_Max_Template', SCU: 64, X: 2.5, Y: 20, Z: 2.5 }
		);
		raw.Systems!.CargoGrids!.Ports!.push(
			{ HardpointName: 'cargo_grid_l', ClassName: 'MISC_Starlancer_CargoGrid_Max_Template' },
			{ HardpointName: 'cargo_grid_r', ClassName: 'MISC_Starlancer_CargoGrid_Max_Template' }
		);
		raw.Cargo = 48 * 2 + 64 * 2;
		const { ship } = normalizeVehicle(raw);
		expect(ship.grids.map((g) => `${g.id}=${g.name}`)).toEqual([
			'left=Left',
			'right=Right',
			'max-left=Max left',
			'max-right=Max right'
		]);
	});

	it('Reliant Kore: words of the published Name are stripped from the grid class', () => {
		const { ship } = normalizeVehicle(
			simpleShip('MISC_Reliant', 'MISC Reliant Kore', 'MISC_Reliant_CargoGrid_KORE', [
				'hardpoint_cargogrid_left',
				'hardpoint_cargogrid_right'
			])
		);
		expect(ship.grids.map((g) => g.id)).toEqual(['left', 'right']);
	});

	it('Idris hangar: repeated positions get a running number per side', () => {
		const left = ['CargoGrid_Hangar_Left', 'CargoGrid_Hangar_Left_2', 'CargoGrid_Hangar_Left_3'];
		const right = ['CargoGrid_Hangar_Right', 'CargoGrid_Hangar_Right_2'];
		const { ship } = normalizeVehicle(
			simpleShip('AEGS_Idris_P', 'Aegis Idris-P', 'AEGS_Idris_CargoGrid_Hangar', [
				...left,
				...right
			])
		);
		expect(ship.grids.map((g) => g.name)).toEqual([
			'Hangar left 1',
			'Hangar left 2',
			'Hangar left 3',
			'Hangar right 1',
			'Hangar right 2'
		]);
	});

	it('falls back to numbering for identical or numeric-only hardpoints', () => {
		const ship = shipWords('X_Ship', 'X Ship');
		expect(positionWords(['Hardpoint_Cargo', 'Hardpoint_Cargo'], ship)).toBeNull();
		expect(positionWords(['hp_module_01', 'hp_module_02'], ship)).toBeNull();
		expect(positionWords(['hp_left', null], ship)).toBeNull();
		expect(positionWords(['hp_left'], ship)).toBeNull();
		expect(
			positionWords(
				['hardpoint_cargo_left_hermes', 'hardpoint_cargo_right_hermes'],
				shipWords('RSI_Hermes', 'RSI Hermes')
			)?.words
		).toEqual([['left'], ['right']]);
	});

	it('warns about a 1 SCU MaxSize on a large grid', () => {
		const raw = simpleShip('RSI_Hermes', 'RSI Hermes', 'RSI_Hermes_CargoInventory_Main', [
			'hardpoint_cargo_left_hermes',
			'hardpoint_cargo_right_hermes'
		]);
		for (const g of raw.CargoGrids!) g.MaxSize = unit;
		const { ship, warnings } = normalizeVehicle(raw);
		expect(ship.grids.map((g) => g.id)).toEqual(['main-left', 'main-right']);
		expect(warnings.filter((w) => /MaxSize is 1 SCU/.test(w))).toHaveLength(2);
	});
});

/* ---------- names, prefixes and representatives ---------- */

describe('edition names and representatives', () => {
	const exec = (className: string) =>
		normalizeVehicle(
			simpleShip(className, 'Cutlass Black PYAM Exec', 'DRAK_Cutlass_Black_CargoGrid', ['hp'])
		).ship;

	it('adds the manufacturer prefix the game left out', () => {
		const ship = exec('DRAK_Cutlass_Black_Exec_Military');
		expect(ship.fullName).toBe('Drake Cutlass Black PYAM Exec');
		expect(ship.name).toBe('Cutlass Black PYAM Exec');
		expect(ship.slug).toBe('drake-cutlass-black-pyam-exec');
	});

	it('tells sibling editions with one published name apart, leaving base-hull re-releases alone', () => {
		const [military, stealth] = disambiguateNames([
			exec('DRAK_Cutlass_Black_Exec_Military'),
			exec('DRAK_Cutlass_Black_Exec_StealthIndustrial')
		]);
		expect(military.fullName).toBe('Drake Cutlass Black PYAM Exec Military');
		expect(stealth.fullName).toBe('Drake Cutlass Black PYAM Exec Stealth Industrial');
		expect(stealth.name).toBe('Cutlass Black PYAM Exec Stealth Industrial');
		const base = normalizeVehicle(caterpillar()).ship;
		const boarded = normalizeVehicle(
			caterpillar({ ClassName: 'DRAK_Caterpillar_Boarded', UUID: 'b' })
		).ship;
		expect(disambiguateNames([base, boarded]).map((s) => s.fullName)).toEqual([
			'Drake Caterpillar',
			'Drake Caterpillar'
		]);
	});

	it('a preferred hull represents its fold group even when a sibling has the shorter class name', () => {
		const grid = 'RSI_Constellation_CargoGrid_Main';
		const aquila = normalizeVehicle(
			simpleShip('RSI_Constellation_Aquila', 'RSI Constellation Aquila', grid, [
				'hardpoint_cargogrid'
			])
		).ship;
		const andromeda = normalizeVehicle(
			simpleShip('RSI_Constellation_Andromeda', 'RSI Constellation Andromeda', grid, [
				'hardpoint_cargogrid'
			])
		).ship;
		const { representatives, variants } = foldVariants(assignSlugs([aquila, andromeda]));
		expect(representatives.map((r) => r.slug)).toEqual(['rsi-constellation-andromeda']);
		expect(variants.map((v) => `${v.slug}->${v.variantOf}`)).toEqual([
			'rsi-constellation-aquila->rsi-constellation-andromeda'
		]);
	});
});
