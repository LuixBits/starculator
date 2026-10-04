import { describe, expect, it } from 'vitest';
import { decodePlan, encodePlan, encodePlanQuery } from './url.ts';
import { SNAPSHOT_VERSION, emptyCounts, type PlanSnapshot } from './snapshot.ts';

function plan(partial: Partial<PlanSnapshot> = {}): PlanSnapshot {
	return {
		version: SNAPSHOT_VERSION,
		shipSlug: 'drake-caterpillar',
		groups: [
			{
				id: 'g1',
				label: 'Contract A',
				colorIndex: 0,
				unloadOrder: 0,
				counts: { ...emptyCounts(), 32: 4, 16: 2 }
			},
			{
				id: 'g2',
				label: 'Contract B',
				colorIndex: 1,
				unloadOrder: 1,
				counts: { ...emptyCounts(), 8: 6 }
			}
		],
		view: 'top',
		...partial
	};
}

describe('url codec', () => {
	it('encodes the documented compact form', () => {
		const q = encodePlanQuery(plan());
		expect(q).toBe('?g=Contract+A%3A32x4%2C16x2%3BContract+B%3A8x6&v=top');
		expect(decodeURIComponent(q.replace(/\+/g, ' '))).toBe(
			'?g=Contract A:32x4,16x2;Contract B:8x6&v=top'
		);
	});

	it('round-trips groups, counts and view', () => {
		const original = plan();
		const decoded = decodePlan(encodePlan(original), 'drake-caterpillar');
		expect(decoded).toEqual(original);
	});

	it('escapes delimiters inside labels', () => {
		const original = plan({
			groups: [
				{
					id: 'g1',
					label: 'Red Wind: waste; 2x, pls',
					colorIndex: 0,
					unloadOrder: 0,
					counts: { ...emptyCounts(), 1: 3 }
				}
			],
			view: 'orbit'
		});
		const decoded = decodePlan(encodePlan(original), 'drake-caterpillar');
		expect(decoded?.groups[0].label).toBe('Red Wind: waste; 2x, pls');
		expect(decoded?.groups[0].counts[1]).toBe(3);
	});

	it('returns null when the query holds no plan, and omits defaults when encoding', () => {
		expect(decodePlan(new URLSearchParams(''), 'x')).toBeNull();
		expect(decodePlan(new URLSearchParams('foo=bar'), 'x')).toBeNull();
		expect(encodePlanQuery(plan({ groups: [], view: 'orbit' }))).toBe('');
	});

	it('ignores garbage sizes and clamps counts', () => {
		const decoded = decodePlan(new URLSearchParams('g=Junk:3x2,32x99999,abc'), 'x');
		expect(decoded?.groups).toHaveLength(1);
		expect(decoded?.groups[0].counts[32]).toBe(999);
		expect(decoded?.groups[0].counts[2]).toBe(0);
	});
});
