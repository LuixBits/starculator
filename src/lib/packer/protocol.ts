/**
 * Message protocol between `client.ts` and `packer.worker.ts`. Kept in its own
 * module (no worker globals) so the request handler can be unit-tested.
 */
import type { CargoGrid, PackGroup, PackItem, PackOptions, PackResult } from '../data/types.ts';
import { pack } from './pack.ts';

export interface PackRequest {
	id: number;
	grids: CargoGrid[];
	items: PackItem[];
	groups: PackGroup[];
	options?: PackOptions;
}

export type PackResponse = { id: number; result: PackResult } | { id: number; error: string };

export function handlePackRequest(request: PackRequest): PackResponse {
	try {
		const result = pack(request.grids, request.items, request.groups ?? [], request.options);
		return { id: request.id, result };
	} catch (err) {
		return { id: request.id, error: err instanceof Error ? err.message : String(err) };
	}
}
