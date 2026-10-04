// Runs in the vitest "client" project (real Chromium): exercises the module
// worker end to end through Vite's `new Worker(new URL(...))` handling.
import { describe, expect, it } from 'vitest';
import { createPackerClient } from './client.ts';
import { pack } from './pack.ts';
import { cutlassBlack } from './fixtures.ts';
import { makeGroups, makeItems, stable } from './test-helpers.ts';

describe('createPackerClient in the browser', () => {
	it('packs in a real module worker and matches the synchronous packer', async () => {
		expect(typeof Worker).toBe('function');
		const client = createPackerClient();
		const items = [...makeItems(8, 3, 'g1'), ...makeItems(2, 5, 'g0')];
		const groups = makeGroups(2);
		const [a, b] = await Promise.all([
			client.pack(cutlassBlack, items, groups, { seed: 3 }),
			client.pack(cutlassBlack, items, groups, { seed: 4 })
		]);
		expect(client.usingWorker).toBe(true);
		expect(stable(a)).toEqual(stable(pack(cutlassBlack, items, groups, { seed: 3 })));
		expect(stable(b)).toEqual(stable(pack(cutlassBlack, items, groups, { seed: 4 })));
		client.terminate();
		expect(client.usingWorker).toBe(false);
	});

	it('rejects pending requests on terminate and recovers afterwards', async () => {
		const client = createPackerClient();
		const pending = client.pack(cutlassBlack, makeItems(1, 40), []);
		client.terminate();
		await expect(pending).rejects.toThrow('terminated');
		const again = await client.pack(cutlassBlack, makeItems(1, 2), []);
		expect(again.placed).toHaveLength(2);
		client.terminate();
	});
});
