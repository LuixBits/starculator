/**
 * Slug allocation, edition-name disambiguation and variant folding.
 *
 * Vehicles of one manufacturer with the same cargo capacity and the same
 * multiset of grids (cells + allowed sizes) are one ship for cargo purposes.
 * The representative is the preferred hull (representatives.ts) or else the
 * base hull (fewest edition tokens, then shortest ClassName); the others are
 * recorded as variants and not emitted as ships.
 */

import type { VariantEntry } from '#lib/data/ships.ts';
import type { Ship } from '#lib/data/types.ts';
import {
	classTokens,
	compareByBaseness,
	slugify,
	stripManufacturer,
	titleCase,
	variantScore
} from './naming.ts';
import { preferenceRank } from './representatives.ts';

/** Preferred and base hulls first so they claim the plain slug; the order is also the fold tiebreak. */
export function sortByBaseness(ships: readonly Ship[]): Ship[] {
	return [...ships].sort(
		(a, b) =>
			preferenceRank(a.className) - preferenceRank(b.className) ||
			compareByBaseness(a.className, b.className)
	);
}

/** ClassName tokens after manufacturer and hull that the name does not already spell out. */
function extraClassTokens(ship: Ship): string[] {
	const nameWords = new Set(slugify(ship.fullName).split('-'));
	return classTokens(ship.className)
		.slice(2)
		.filter((t) => slugify(t).length > 0 && !nameWords.has(slugify(t)));
}

/**
 * Editions that share a published Name with a sibling edition of equal
 * standing (no base hull among them, e.g. the two "Corsair PYAM Exec" ships)
 * get their distinguishing ClassName tokens appended: "Corsair PYAM Exec
 * Military" / "Corsair PYAM Exec Stealth Industrial". Re-releases that share
 * the base hull's name are left alone; they fold into it anyway.
 */
export function disambiguateNames(ships: readonly Ship[]): Ship[] {
	const groups = new Map<string, Ship[]>();
	for (const ship of ships) {
		const key = `${ship.manufacturer.code}|${ship.fullName}`;
		groups.set(key, [...(groups.get(key) ?? []), ship]);
	}
	const renamed = new Map<string, Ship>();
	for (const group of groups.values()) {
		if (group.length < 2 || group.some((s) => variantScore(s.className) === 0)) continue;
		for (const ship of group) {
			const extra = extraClassTokens(ship);
			if (extra.length === 0) continue;
			const fullName = `${ship.fullName} ${titleCase(extra)}`;
			renamed.set(ship.className, {
				...ship,
				fullName,
				name: stripManufacturer(fullName, ship.manufacturer),
				slug: slugify(fullName)
			});
		}
	}
	return ships.map((s) => renamed.get(s.className) ?? s);
}

/**
 * Gives every ship a unique slug: kebab of fullName, then with the ClassName
 * tokens the name does not already carry, then a numeric suffix.
 */
export function assignSlugs(ships: readonly Ship[]): Ship[] {
	const taken = new Set<string>();
	return sortByBaseness(disambiguateNames(ships)).map((ship) => {
		const base = slugify(ship.fullName);
		const extra = extraClassTokens(ship).map(slugify);
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
