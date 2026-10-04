/**
 * Per-ship plan persistence in IndexedDB (Dexie). Browser-only: every entry
 * point returns early when there is no window, and Dexie is imported lazily so
 * SSR never touches it.
 */
import type { Dexie, EntityTable } from 'dexie';
import { parseSnapshot, type PlanSnapshot } from './snapshot.ts';

export const DB_NAME = 'starculator';
export const SCHEMA_VERSION = 1;

export interface StoredPlan {
	shipSlug: string;
	schemaVersion: number;
	updatedAt: string;
	plan: PlanSnapshot;
}

type PlanDb = Dexie & { plans: EntityTable<StoredPlan, 'shipSlug'> };

let dbPromise: Promise<PlanDb | null> | null = null;

function hasIndexedDb(): boolean {
	return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function openDb(): Promise<PlanDb | null> {
	if (!hasIndexedDb()) return null;
	if (!dbPromise) {
		dbPromise = import('dexie')
			.then(({ Dexie: DexieCtor }) => {
				const db = new DexieCtor(DB_NAME) as PlanDb;
				db.version(SCHEMA_VERSION).stores({ plans: '&shipSlug' });
				return db;
			})
			.catch(() => null);
	}
	return dbPromise;
}

export async function loadStoredPlan(shipSlug: string): Promise<PlanSnapshot | null> {
	const db = await openDb();
	if (!db) return null;
	try {
		const row = await db.plans.get(shipSlug);
		return row ? parseSnapshot(row.plan, shipSlug) : null;
	} catch {
		return null;
	}
}

export async function storePlan(plan: PlanSnapshot): Promise<void> {
	const db = await openDb();
	if (!db) return;
	try {
		await db.plans.put({
			shipSlug: plan.shipSlug,
			schemaVersion: SCHEMA_VERSION,
			updatedAt: new Date().toISOString(),
			plan
		});
	} catch {
		// Storage can be denied (private mode, quota); the plan still lives in the URL.
	}
}

export async function deleteStoredPlan(shipSlug: string): Promise<void> {
	const db = await openDb();
	if (!db) return;
	try {
		await db.plans.delete(shipSlug);
	} catch {
		// Same as above: not fatal.
	}
}

/** Returns a debounced saver; call `cancel()` when the owner unmounts. */
export function createDebouncedSaver(delayMs = 400) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return {
		save(plan: PlanSnapshot) {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				void storePlan(plan);
			}, delayMs);
		},
		cancel() {
			if (timer) clearTimeout(timer);
			timer = null;
		}
	};
}

/* ---------- JSON export / import ---------- */

export function planToJson(plan: PlanSnapshot): string {
	return JSON.stringify(
		{ app: 'starculator', exportedAt: new Date().toISOString(), ...plan },
		null,
		2
	);
}

export function planFromJson(text: string, fallbackSlug?: string): PlanSnapshot | null {
	try {
		return parseSnapshot(JSON.parse(text), fallbackSlug);
	} catch {
		return null;
	}
}

/** Triggers a browser download of the plan as `<slug>-plan.json`. */
export function downloadPlan(plan: PlanSnapshot): void {
	if (typeof document === 'undefined') return;
	const blob = new Blob([planToJson(plan)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${plan.shipSlug}-plan.json`;
	a.rel = 'noopener';
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
