/**
 * Hand-picked representatives for fold groups.
 *
 * foldVariants() groups vehicles whose cargo grids are identical and keeps one
 * as the ship the planner shows; the others become aliases. The automatic
 * tiebreak (fewest edition tokens, then shortest ClassName) is right for
 * editions of one hull (Caterpillar / Caterpillar Pirate) but arbitrary for
 * sibling hulls that merely share a hold. This list names the hull haulers
 * actually fly for those groups. Each entry carries its reasoning; the ingest
 * warns when an entry no longer matches a vehicle in the data.
 *
 * This lives next to the ingest rather than in overrides.json because the
 * shared ShipOverride contract has no field for it (see the data report).
 */
export const PREFERRED_REPRESENTATIVES: ReadonlyMap<string, string> = new Map([
	[
		'RSI_Constellation_Andromeda',
		'Base Constellation and the common cargo variant; the Aquila is the exploration sibling with the same 96 SCU hold.'
	],
	[
		'AEGS_Hammerhead_GS',
		'The Tiburon reuses the Hammerhead GS cargo grid class; the Hammerhead is the hull players know.'
	],
	[
		'DRAK_Cutlass_Blue',
		'Older of the two Cutlass sister ships that share the 2 × 6 SCU side grids; the Red is the medical refit.'
	],
	[
		'RSI_Apollo_Medivac',
		'Base Apollo; the Triage is the up-tiered medical sibling with the same two 16 SCU grids.'
	]
]);

/** 0 for a preferred representative, 1 otherwise; sorts preferred hulls first. */
export function preferenceRank(className: string): number {
	return PREFERRED_REPRESENTATIVES.has(className) ? 0 : 1;
}
