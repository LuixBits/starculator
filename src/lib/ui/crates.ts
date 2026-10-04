import { CONTAINER_CELLS, type ContainerSize } from '../data/types.ts';

/** CSS colour for a group colour slot (maps to --crate-1 … --crate-7). */
export function crateColor(colorIndex: number): string {
	return `var(--crate-${(((colorIndex % 7) + 7) % 7) + 1})`;
}

/** Human-readable footprint, e.g. "8×2×2 cells". */
export function crateFootprint(size: ContainerSize): string {
	const c = CONTAINER_CELLS[size];
	return `${c.x}×${c.y}×${c.z}`;
}

export const UNPLACED_REASON: Record<
	'no-space' | 'too-large-for-any-grid' | 'size-not-allowed',
	string
> = {
	'no-space': 'No space left',
	'too-large-for-any-grid': 'Too large for any grid',
	'size-not-allowed': 'Size not permitted in any grid'
};
