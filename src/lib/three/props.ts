/**
 * Props of the hold viewer, shared by the lazy shell (HoldScene.svelte) and
 * the Threlte viewer it loads (HoldViewer.svelte).
 */
import type { PackGroup, PackItem, Placement, Ship } from '../data/types.ts';

export type HoldView = 'perspective' | 'top';

export interface HoldSceneProps {
	ship: Ship;
	placements: Placement[];
	groups: PackGroup[];
	items: PackItem[];
	selectedItemId?: string | null;
	onselect?: (itemId: string | null) => void;
	/** Bindable. */
	view?: HoldView;
	highlightGridId?: string | null;
	/** Grid name tags and door "RAMP" tags as HTML overlays (class `hold-label`). */
	showLabels?: boolean;
	/**
	 * Wireframe hull bounding box for scale. Defaults to on only when the
	 * grids have curated offsets; in a schematic layout the hull says nothing.
	 */
	showSilhouette?: boolean;
	class?: string;
}

/** The viewer itself takes everything but the wrapper's class. */
export type HoldViewerProps = Omit<HoldSceneProps, 'class'>;
