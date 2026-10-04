import { error } from '@sveltejs/kit';
import { getAllSlugs, getVariantEntry, loadShipBySlug } from '#lib/state/adapters.ts';
import type { EntryGenerator, PageLoad } from './$types';

/** Every known ship, representatives and folded variants, prerenders to its own planner page. */
export const entries: EntryGenerator = () => getAllSlugs().map((slug) => ({ slug }));

export const load: PageLoad = async ({ params }) => {
	const ship = await loadShipBySlug(params.slug);
	if (!ship) error(404, `No ship called "${params.slug}"`);
	// A variant URL shows the representative hull; the page says so.
	const variant = getVariantEntry(params.slug);
	return { ship, variant };
};
