import { error } from '@sveltejs/kit';
import { getAllSlugs, loadShipBySlug } from '#lib/state/adapters.ts';
import type { EntryGenerator, PageLoad } from './$types';

/** Every known ship prerenders to its own planner page. */
export const entries: EntryGenerator = () => getAllSlugs().map((slug) => ({ slug }));

export const load: PageLoad = async ({ params }) => {
	const ship = await loadShipBySlug(params.slug);
	if (!ship) error(404, `No ship called "${params.slug}"`);
	return { ship };
};
