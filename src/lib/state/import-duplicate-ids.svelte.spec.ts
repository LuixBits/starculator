import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ManifestSheet from '../components/ManifestSheet.svelte';
import { Plan } from './plan.svelte.ts';
import { planFromJson } from './persist.ts';
import { loadShip } from '../data/ships.ts';

describe('ManifestSheet with an imported plan whose groups share an id', () => {
	it('mounts without throwing', async () => {
		const ship = await loadShip('drake-caterpillar');
		expect(ship).not.toBeNull();
		const snapshot = planFromJson(
			JSON.stringify({
				shipSlug: 'drake-caterpillar',
				groups: [
					{ id: 'g1', counts: { 8: 1 } },
					{ id: 'g1', counts: { 16: 1 } }
				]
			})
		);
		expect(snapshot).not.toBeNull();
		const plan = new Plan('drake-caterpillar', snapshot);
		expect(() => render(ManifestSheet, { plan, ship: ship!, onpack: () => {} })).not.toThrow();
	});
});
