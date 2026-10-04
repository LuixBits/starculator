/**
 * Public surface of the lattice packer. UI code imports from here.
 */
export {
	pack,
	resolveOptions,
	orderGrids,
	DEFAULT_PACK_OPTIONS,
	MAX_RESTARTS,
	type ResolvedPackOptions
} from './pack.ts';
export {
	expandCounts,
	validatePlacement,
	validatePlan,
	gridCapacityByContainer,
	containerDims,
	type PlacementProblem,
	type PlacementProblemCode,
	type PlacementValidation,
	type ValidateOptions
} from './helpers.ts';
export {
	DEFAULT_DOOR,
	doorOf,
	cellsToMeters,
	metersToCells,
	volumeOf,
	sameCells,
	fitsWithin,
	orientationsOf,
	containerOrientations,
	scuOfDims,
	isCanonicalDims,
	depthFromDoor,
	maxDepth,
	isIntegerVec
} from './geometry.ts';
export { Lattice } from './lattice.ts';
export { createRng, shuffle, type Rng } from './random.ts';
export { createPackerClient, type PackerClient, type PackerClientOptions } from './client.ts';
export { handlePackRequest, type PackRequest, type PackResponse } from './protocol.ts';
