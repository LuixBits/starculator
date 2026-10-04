/**
 * Browser-side client for the packer worker. The Worker is created lazily on
 * the first `pack()` call; when `Worker` does not exist (SSR, node tests) the
 * client runs `pack()` synchronously on the calling thread and still returns a
 * promise, so callers never branch on the environment.
 */
import type { CargoGrid, PackGroup, PackItem, PackOptions, PackResult } from '../data/types.ts';
import { pack } from './pack.ts';
import type { PackRequest, PackResponse } from './protocol.ts';

export interface PackerClient {
	pack(
		grids: CargoGrid[],
		items: PackItem[],
		groups: PackGroup[],
		options?: PackOptions
	): Promise<PackResult>;
	/** Stops the worker (if any) and rejects pending requests. Safe to call twice. */
	terminate(): void;
	/** True while a worker is alive. */
	readonly usingWorker: boolean;
}

export interface PackerClientOptions {
	/** Never create a worker; always pack on the calling thread. */
	forceSync?: boolean;
}

interface Pending {
	resolve: (result: PackResult) => void;
	reject: (error: Error) => void;
}

export function createPackerClient(options: PackerClientOptions = {}): PackerClient {
	let worker: Worker | null = null;
	let workerFailed = false;
	let nextId = 1;
	const pending = new Map<number, Pending>();

	const failAll = (error: Error) => {
		for (const p of pending.values()) p.reject(error);
		pending.clear();
	};

	const dispose = () => {
		worker?.terminate();
		worker = null;
	};

	const getWorker = (): Worker | null => {
		if (worker) return worker;
		if (options.forceSync || workerFailed || typeof Worker === 'undefined') return null;
		try {
			const w = new Worker(new URL('./packer.worker.ts', import.meta.url), { type: 'module' });
			w.onmessage = (event: MessageEvent<PackResponse>) => {
				const msg = event.data;
				const p = pending.get(msg.id);
				if (!p) return;
				pending.delete(msg.id);
				if ('error' in msg) p.reject(new Error(msg.error));
				else p.resolve(msg.result);
			};
			w.onerror = (event: ErrorEvent) => {
				// A broken worker (e.g. failed module load) must not hang callers;
				// subsequent calls fall back to the synchronous packer.
				workerFailed = true;
				dispose();
				failAll(new Error(event.message || 'Packer worker failed'));
			};
			worker = w;
			return w;
		} catch {
			workerFailed = true;
			return null;
		}
	};

	return {
		get usingWorker() {
			return worker !== null;
		},
		pack(grids, items, groups, packOptions) {
			const w = getWorker();
			if (!w) {
				return new Promise<PackResult>((resolve, reject) => {
					try {
						resolve(pack(grids, items, groups, packOptions));
					} catch (err) {
						reject(err instanceof Error ? err : new Error(String(err)));
					}
				});
			}
			const id = nextId++;
			const request: PackRequest = { id, grids, items, groups, options: packOptions };
			return new Promise<PackResult>((resolve, reject) => {
				pending.set(id, { resolve, reject });
				w.postMessage(request);
			});
		},
		terminate() {
			dispose();
			failAll(new Error('Packer client terminated'));
		}
	};
}
