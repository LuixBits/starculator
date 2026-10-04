/**
 * Access to the generated ship data. The index and meta are bundled; full ships
 * are code-split per slug via import.meta.glob and loaded on demand. Works in
 * SSR/prerender and in the browser (no DOM access).
 */

import indexJson from './generated/index.json';
import metaJson from './generated/meta.json';
import variantsJson from './generated/variants.json';
import type { DataMeta, Ship, ShipIndexEntry } from './types.ts';

/** A vehicle folded into a representative ship because its cargo grids are identical. */
export interface VariantEntry {
	slug: string;
	name: string;
	fullName: string;
	className: string;
	/** Slug of the representative ship. */
	variantOf: string;
}

const shipModules = import.meta.glob<{ default: Ship }>('./generated/ships/*.json');

const index = indexJson as ShipIndexEntry[];
const meta = metaJson as DataMeta;
const variants = variantsJson as VariantEntry[];

/** Representatives only, sorted by manufacturer then name. */
export function getShipIndex(): ShipIndexEntry[] {
	return index;
}

export function getMeta(): DataMeta {
	return meta;
}

/** Folded variants, for search aliases and "also covers" hints. */
export function getVariants(): VariantEntry[] {
	return variants;
}

/** Every representative slug; use for prerender entries. */
export function getAllSlugs(): string[] {
	return index.map((entry) => entry.slug);
}

export function getIndexEntry(slug: string): ShipIndexEntry | null {
	return index.find((entry) => entry.slug === slug) ?? null;
}

/** Resolves a variant slug to its representative; representatives resolve to themselves. */
export function resolveSlug(slug: string): string | null {
	if (index.some((entry) => entry.slug === slug)) return slug;
	return variants.find((v) => v.slug === slug)?.variantOf ?? null;
}

export async function loadShip(slug: string): Promise<Ship | null> {
	const loader = shipModules[`./generated/ships/${slug}.json`];
	if (!loader) return null;
	const module = await loader();
	return module.default;
}
