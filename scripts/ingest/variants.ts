/**
 * Slug allocation and variant folding.
 *
 * Vehicles of one manufacturer with the same cargo capacity and the same
 * multiset of grids (cells + allowed sizes) are one ship for cargo purposes.
 * The base hull (fewest edition tokens, then shortest ClassName) becomes the
 * representative; the others are recorded as variants and not emitted as ships.
 */

import type { VariantEntry } from '#lib/data/ships.ts';
import type { Ship } from '#lib/data/types.ts';
import { classTokens, compareByBaseness, slugify } from './naming.ts';

/** Base hulls first so they claim the plain slug; the order is also the fold tiebreak. */
export function sortByBaseness(ships: readonly Ship[]): Ship[] {
	return [...ships].sort((a, b) => compareByBaseness(a.className, b.className));
}

/**
 * Gives every ship a unique slug: kebab of fullName, then with the ClassName
 * tokens the name does not already carry, then a numeric suffix.
 */
export function assignSlugs(ships: readonly Ship[]): Ship[] {
	const taken = new Set<string>();
	return sortByBaseness(ships).map((ship) => {
		const base = slugify(ship.fullName);
		const extra = classTokens(ship.className)
			.slice(2)
			.map(slugify)
			.filter((t) => t.length > 0 && !base.split('-').includes(t));
		const candidates = [base, extra.length ? `${base}-${extra.join('-')}` : null];
		let slug = candidates.find((c): c is string => c !== null && !taken.has(c));
		for (let n = 2; slug === undefined; n++) if (!taken.has(`${base}-${n}`)) slug = `${base}-${n}`;
		taken.add(slug);
		return { ...ship, slug };
	});
}

function gridSignature(ship: Ship): string {
	return ship.grids
		.map((g) => `${g.cells.x}x${g.cells.y}x${g.cells.z}/${g.allowedSizes.join(',')}`)
		.sort()
		.join(';');
}

export function foldKey(ship: Ship): string {
	return `${ship.manufacturer.code}|${ship.cargoScu}|${gridSignature(ship)}`;
}

export interface FoldResult {
	representatives: Ship[];
	variants: VariantEntry[];
}

/** Folds identical-cargo variants; input must already carry unique slugs. */
export function foldVariants(ships: readonly Ship[]): FoldResult {
	const groups = new Map<string, Ship[]>();
	for (const ship of sortByBaseness(ships)) {
		const key = foldKey(ship);
		const group = groups.get(key);
		if (group) group.push(ship);
		else groups.set(key, [ship]);
	}
	const representatives: Ship[] = [];
	const variants: VariantEntry[] = [];
	for (const [representative, ...rest] of groups.values()) {
		const variantSlugs = rest.map((v) => v.slug).sort();
		representatives.push({ ...representative, variantOf: null, variants: variantSlugs });
		for (const v of rest)
			variants.push({
				slug: v.slug,
				name: v.name,
				fullName: v.fullName,
				className: v.className,
				variantOf: representative.slug
			});
	}
	variants.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
	return { representatives, variants };
}
