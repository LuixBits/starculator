import { describe, expect, it } from 'vitest';
import caterpillarJson from '../data/generated/ships/drake-caterpillar.json';
import type { Ship } from '../data/types.ts';
import { Plan } from './plan.svelte.ts';
import { parseSnapshot } from './snapshot.ts';

const caterpillar = caterpillarJson as Ship;

describe('Plan store', () => {
	it('starts with one group and expands counts into items', () => {
		const plan = new Plan('drake-caterpillar');
		expect(plan.groups).toHaveLength(1);
		plan.setCount('g1', 24, 2);
		plan.setCount('g1', 1, 3);
		expect(plan.items.map((i) => i.scu)).toEqual([24, 24, 1, 1, 1]);
		expect(plan.totalScu).toBe(51);
		expect(plan.hasItems).toBe(true);
	});

	it('packs with the lattice packer and marks stale on change', async () => {
		const plan = new Plan('drake-caterpillar');
		plan.setCount('g1', 24, 4);
		plan.setCount('g1', 32, 1);
		const result = await plan.pack(caterpillar.grids);
		expect(result?.placed).toHaveLength(4);
		// No Caterpillar grid accepts a 32-SCU container.
		expect(result?.unplaced[0]?.reason).toBe('size-not-allowed');
		expect(result?.usedScu).toBe(96);
		expect(result?.capacityScu).toBe(caterpillar.cargoScu);
		expect(plan.status).toBe('ready');
		plan.increment('g1', 8, 1);
		expect(plan.status).toBe('stale');
	});

	it('drops a stale pack when a newer one was started', async () => {
		const plan = new Plan('drake-caterpillar');
		plan.setCount('g1', 8, 2);
		const first = plan.pack(caterpillar.grids);
		plan.setCount('g1', 8, 3);
		const second = plan.pack(caterpillar.grids);
		expect(await first).toBeNull();
		expect((await second)?.placed).toHaveLength(3);
		expect(plan.result?.placed).toHaveLength(3);
	});

	it('round-trips through a snapshot and tolerates junk on restore', () => {
		const plan = new Plan('drake-caterpillar');
		plan.addGroup('Covalex');
		plan.setCount('g2', 16, 3);
		const snap = plan.snapshot();
		const copy = new Plan('drake-caterpillar', snap);
		expect(copy.groups.map((g) => g.label)).toEqual(['Contract A', 'Covalex']);
		expect(copy.groups[1].counts[16]).toBe(3);
		expect(
			parseSnapshot({ groups: [{ counts: { 16: 'x', 99: 2, 8: 1.7 } }] }, 'slug')?.groups[0].counts
		).toEqual({
			1: 0,
			2: 0,
			4: 0,
			8: 1,
			16: 0,
			24: 0,
			32: 0
		});
	});

	it('caps groups at four and keeps colours distinct', () => {
		const plan = new Plan('x');
		for (let i = 0; i < 5; i++) plan.addGroup();
		expect(plan.groups).toHaveLength(4);
		expect(new Set(plan.groups.map((g) => g.colorIndex)).size).toBe(4);
		plan.removeGroup('g2');
		expect(plan.groups.map((g) => g.unloadOrder)).toEqual([0, 1, 2]);
	});
});
