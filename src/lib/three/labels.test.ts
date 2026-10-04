import { describe, expect, it } from 'vitest';
import {
	MAX_BAY_TAGS,
	MAX_GRID_TAGS,
	abbreviateGridName,
	abbreviateGridNames,
	doorSites,
	labelMode
} from './labels.ts';
import { layoutGrids } from './layout.ts';
import { grid } from './test-grids.ts';

describe('labelMode', () => {
	it('spells out every grid up to MAX_GRID_TAGS', () => {
		expect(labelMode(1, 1)).toBe('grid');
		expect(labelMode(MAX_GRID_TAGS, MAX_GRID_TAGS)).toBe('grid');
	});

	it('falls back to one tag per bay when bays group the grids', () => {
		// Caterpillar: 14 grids in 5 bays.
		expect(labelMode(14, 5)).toBe('bay');
		expect(labelMode(12, MAX_BAY_TAGS)).toBe('bay');
	});

	it('never goes silent: Hull C (16 single-grid bays) and Idris (25/21) get compact tags', () => {
		expect(labelMode(16, 16)).toBe('compact');
		expect(labelMode(25, 21)).toBe('compact');
	});
});

describe('abbreviateGridName', () => {
	it('keeps numbers and takes the first letter of every word', () => {
		expect(abbreviateGridName('Main 1')).toBe('M1');
		expect(abbreviateGridName('Outer 12')).toBe('O12');
		expect(abbreviateGridName('Room small 2')).toBe('RS2');
		expect(abbreviateGridName('Additional storage 4')).toBe('AS4');
	});

	it('drops punctuation-only tokens and leading punctuation', () => {
		expect(abbreviateGridName('Module 1 · main')).toBe('M1M');
		expect(abbreviateGridName('(Nose) access')).toBe('NA');
	});

	it('never returns an empty tag', () => {
		expect(abbreviateGridName('')).toBe('?');
		expect(abbreviateGridName(' · ')).toBe('?');
	});
});

describe('abbreviateGridNames', () => {
	it('leaves unique abbreviations alone (Hull C)', () => {
		const names = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [`Main ${n}`, `Outer ${n}`]);
		const tags = abbreviateGridNames(names);
		expect(tags).toContain('M1');
		expect(tags).toContain('O8');
		expect(new Set(tags).size).toBe(names.length);
	});

	it('suffixes collisions in order so every tag is unique', () => {
		expect(abbreviateGridNames(['Main 1', 'Mid 1', 'Main 2'])).toEqual(['M1a', 'M1b', 'M2']);
	});

	it('does not run out of suffixes', () => {
		const tags = abbreviateGridNames(Array.from({ length: 30 }, () => 'Same'));
		expect(new Set(tags).size).toBe(30);
		expect(tags[0]).toBe('Sa');
		expect(tags[26]).toBe('Sa2');
	});
});

describe('doorSites', () => {
	const hullC = layoutGrids([
		...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
			grid({ id: `main-${n}`, name: `Main ${n}`, cells: { x: 8, y: 8, z: 6 } })
		),
		...[1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
			grid({ id: `outer-${n}`, name: `Outer ${n}`, cells: { x: 4, y: 8, z: 6 } })
		)
	]);

	it('gives every grid its own assumed site in grid mode', () => {
		const layout = layoutGrids([
			grid({ id: 'a', cells: { x: 2, y: 2, z: 1 } }),
			grid({ id: 'b', cells: { x: 2, y: 2, z: 1 }, door: '+x' })
		]);
		const sites = doorSites(layout, 'grid', 'b');
		expect(sites.map((s) => [s.id, s.face, s.assumed, s.active])).toEqual([
			['door:a', '-y', true, false],
			['door:b', '+x', false, true]
		]);
		const b = layout.byId.get('b');
		expect(sites[1].min).toEqual(b?.origin);
		expect(sites[1].max.x).toBe((b?.origin.x ?? 0) + 2);
	});

	it('merges a bay into one site when its grids share a face, else keeps grids apart', () => {
		const layout = layoutGrids([
			grid({ id: 'm1', cells: { x: 4, y: 6, z: 4 }, bay: 'module-1' }),
			grid({ id: 'm1-walkway', cells: { x: 4, y: 1, z: 2 }, bay: 'module-1' }),
			grid({ id: 'm2', cells: { x: 4, y: 6, z: 4 }, bay: 'module-2', door: '-x' }),
			grid({ id: 'm2-walkway', cells: { x: 4, y: 1, z: 2 }, bay: 'module-2', door: '+x' })
		]);
		const sites = doorSites(layout, 'bay', 'm1-walkway');
		expect(sites.map((s) => s.id)).toEqual(['door:bay:module-1', 'door:m2', 'door:m2-walkway']);
		expect(sites[0].active).toBe(true);
		expect(sites[0].assumed).toBe(true);
		expect(sites[0].min).toEqual(layout.bays[0].min);
		expect(sites[1].assumed).toBe(false);
	});

	it('collapses to one hold-wide tag in compact mode when all faces agree', () => {
		const sites = doorSites(hullC, 'compact', null);
		expect(sites).toHaveLength(1);
		expect(sites[0]).toMatchObject({
			id: 'door:hold',
			face: '-y',
			assumed: true,
			min: hullC.min,
			max: hullC.max
		});
	});

	it('adds the highlighted grid’s own tag in compact mode', () => {
		const sites = doorSites(hullC, 'compact', 'outer-3');
		expect(sites.map((s) => s.id)).toEqual(['door:hold', 'door:outer-3']);
		expect(sites[1].active).toBe(true);
	});

	it('shows only the highlighted grid in compact mode when faces differ', () => {
		const grids = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
			grid({ id: `g${n}`, cells: { x: 2, y: 2, z: 1 }, door: n === 1 ? '+y' : null })
		);
		const layout = layoutGrids(grids);
		expect(doorSites(layout, 'compact', null)).toEqual([]);
		expect(doorSites(layout, 'compact', 'g1').map((s) => s.id)).toEqual(['door:g1']);
	});

	it('returns nothing for an empty hold', () => {
		expect(doorSites(layoutGrids([]), 'compact', null)).toEqual([]);
	});
});
