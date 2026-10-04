import { loadShipIndex } from '#lib/state/adapters.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { index: await loadShipIndex() };
};
