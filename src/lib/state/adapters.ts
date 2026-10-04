/**
 * Thin adapters between the UI and the data / packer modules. The UI imports
 * ONLY from this file for ship data and packing, so the modules behind it can
 * change without touching components.
 *
 * Data comes from the generated scunpacked-data snapshot (#lib/data/ships.ts);
 * packing runs in the lattice packer's Web Worker (#lib/packer) with a
 * synchronous fallback where workers do not exist (SSR, node tests).
 */
import type {
	CargoGrid,
	ContainerSize,
	DataMeta,
	PackGroup,
	PackItem,
	PackOptions,
	PackResult,
	Ship,
	ShipIndexEntry
} from '../data/types.ts';
import {
	getAllSlugs as allRepresentativeSlugs,
	getIndexEntry,
	getMeta,
	getShipIndex,
	getVariants,
	loadShip,
	resolveSlug,
	type VariantEntry
} from '../data/ships.ts';
import { createPackerClient, expandCounts as expand, type PackerClient } from '../packer/index.ts';

/** Picker rows (representative ships only), sorted by manufacturer then name. */
export async function loadShipIndex(): Promise<ShipIndexEntry[]> {
	return getShipIndex();
}

/**
 * Full ship for the planner route; null when the slug is unknown. A variant
 * slug (e.g. a Constellation Andromeda) resolves to the representative hull
 * that carries the identical cargo grids.
 */
export async function loadShipBySlug(slug: string): Promise<Ship | null> {
	const representative = resolveSlug(slug);
	return representative ? loadShip(representative) : null;
}

/** The variant entry for a slug, or null when the slug is a representative (or unknown). */
export function getVariantEntry(slug: string): VariantEntry | null {
	return getVariants().find((v) => v.slug === slug) ?? null;
}

/** Every planner URL to prerender: representatives and their folded variants. */
export function getAllSlugs(): string[] {
	return [...allRepresentativeSlugs(), ...getVariants().map((v) => v.slug)];
}

/**
 * Variant names that fold under each representative, keyed by representative
 * slug, for search and "also covers" hints. Names identical to the
 * representative's own name (edition re-releases) are left out.
 */
export function getShipAliases(): Record<string, string[]> {
	const aliases: Record<string, string[]> = {};
	for (const v of getVariants()) {
		const representative = getIndexEntry(v.variantOf);
		if (!representative || v.name === representative.name) continue;
		const list = aliases[v.variantOf] ?? [];
		if (!list.includes(v.name)) list.push(v.name);
		aliases[v.variantOf] = list;
	}
	return aliases;
}

export function getDataMeta(): DataMeta {
	return getMeta();
}

let packer: PackerClient | null = null;

/** Runs the packer (in a worker in the browser) and resolves with the result. */
export async function runPack(
	grids: readonly CargoGrid[],
	items: readonly PackItem[],
	groups: readonly PackGroup[],
	options: PackOptions = {}
): Promise<PackResult> {
	packer ??= createPackerClient();
	return packer.pack([...grids], [...items], [...groups], options);
}

/** Turns per-size counts into PackItems with stable ids (`<group>-<scu>scu-<n>`). */
export function expandCounts(
	counts: Partial<Record<ContainerSize, number>>,
	group: string
): PackItem[] {
	return expand(counts, group);
}
