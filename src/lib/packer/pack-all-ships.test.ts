/**
 * Review sweep: pack a mixed manifest into every representative ship and check
 * the plan with the packer's own validator (bounds, overlap, support, allowed
 * sizes) plus the result's bookkeeping invariants.
 */
import { describe, expect, it } from 'vitest';
import { getShipIndex, loadShip } from '../data/ships.ts';
import { expandCounts, pack, validatePlan } from './index.ts';
import type { PackGroup } from '../data/types.ts';

const groups: PackGroup[] = [
	{ id: 'g1', label: 'A', colorIndex: 0, unloadOrder: 0 },
	{ id: 'g2', label: 'B', colorIndex: 1, unloadOrder: 1 }
];

describe('pack() over every ship in the generated snapshot', () => {
	it('produces valid, consistent plans', async () => {
		const index = await getShipIndex();
		expect(index.length).toBeGreaterThan(50);
		for (const entry of index) {
			const ship = await loadShip(entry.slug);
			expect(ship, entry.slug).not.toBeNull();
			if (!ship) continue;
			const items = [
				...expandCounts({ 32: 3, 16: 4, 8: 6, 4: 5, 2: 5, 1: 9 }, 'g1'),
				...expandCounts({ 24: 2, 8: 3, 1: 4 }, 'g2')
			];
			const result = pack(ship.grids, items, groups);
			const failures = validatePlan(ship.grids, result.placed);
			expect(
				failures.size,
				`${entry.slug}: ${JSON.stringify([...failures.entries()].slice(0, 2))}`
			).toBe(0);
			const scuById = new Map(items.map((i) => [i.id, i.scu]));
			const placedScu = result.placed.reduce((s, p) => s + (scuById.get(p.itemId) ?? 0), 0);
			expect(result.usedScu, entry.slug).toBe(placedScu);
			expect(result.capacityScu, entry.slug).toBe(ship.grids.reduce((s, g) => s + g.scu, 0));
			expect(result.placed.length + result.unplaced.length, entry.slug).toBe(items.length);
			expect(new Set(result.placed.map((p) => p.itemId)).size, entry.slug).toBe(
				result.placed.length
			);
			const orders = result.placed.map((p) => p.order).sort((a, b) => a - b);
			expect(orders, entry.slug).toEqual(orders.map((_, i) => i));
			for (const u of result.unplaced) {
				if (u.reason === 'size-not-allowed') {
					expect(
						ship.grids.some((g) => g.allowedSizes.includes(u.item.scu)),
						`${entry.slug} ${u.item.id}`
					).toBe(false);
				}
			}
		}
	});
});
