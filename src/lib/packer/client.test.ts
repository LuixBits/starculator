import { describe, expect, it } from 'vitest';
import { createPackerClient } from './client.ts';
import { pack } from './pack.ts';
import { handlePackRequest } from './protocol.ts';
import { titan } from './fixtures.ts';
import { makeItems, stable } from './test-helpers.ts';

describe('createPackerClient without Worker (node / SSR)', () => {
	it('falls back to the synchronous packer and still returns a promise', async () => {
		expect(typeof Worker).toBe('undefined');
		const client = createPackerClient();
		const items = makeItems(4, 2);
		const promise = client.pack(titan, items, []);
		expect(promise).toBeInstanceOf(Promise);
		const result = await promise;
		expect(client.usingWorker).toBe(false);
		expect(stable(result)).toEqual(stable(pack(titan, items, [])));
		client.terminate();
		client.terminate();
		await expect(client.pack(titan, items, [], { restarts: 0 })).resolves.toBeDefined();
	});

	it('can be forced to stay synchronous', async () => {
		const client = createPackerClient({ forceSync: true });
		const r = await client.pack(titan, makeItems(1, 3), []);
		expect(r.placed).toHaveLength(3);
		expect(client.usingWorker).toBe(false);
	});
});

describe('worker protocol', () => {
	it('answers a request with the result under the same id', () => {
		const response = handlePackRequest({ id: 7, grids: titan, items: makeItems(2, 2), groups: [] });
		expect(response.id).toBe(7);
		expect('result' in response && response.result.placed).toHaveLength(2);
	});

	it('turns exceptions into error responses', () => {
		const broken = handlePackRequest({
			id: 3,
			grids: null as unknown as typeof titan,
			items: makeItems(1, 1),
			groups: []
		});
		expect(broken.id).toBe(3);
		expect('error' in broken && broken.error.length).toBeGreaterThan(0);
	});
});
