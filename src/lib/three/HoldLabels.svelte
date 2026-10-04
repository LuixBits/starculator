<script lang="ts">
	/**
	 * HTML overlays: name tags above the hold and a "RAMP" tag at each door.
	 * Only class names are set; the host page styles `.hold-label`.
	 *
	 * Density policy, so a 25-grid capital ship does not drown in tags: up to
	 * MAX_GRID_TAGS grids get one tag each; otherwise, when the ship has bays,
	 * one tag per bay; otherwise no name tags at all. The highlighted grid
	 * always gets its own tag (in bay mode its bay's tag takes the grid's name).
	 */
	import { HTML } from '@threlte/extras';
	import type { HoldLayout } from './layout.ts';
	import { cellToWorld, doorEdge, type WorldTuple } from './space.ts';

	interface Props {
		layout: HoldLayout;
		highlightGridId?: string | null;
	}

	let { layout, highlightGridId = null }: Props = $props();

	const MAX_GRID_TAGS = 8;
	const MAX_BAY_TAGS = 10;

	interface Tag {
		id: string;
		text: string;
		kind: 'grid' | 'door';
		position: WorldTuple;
		active: boolean;
	}

	type Mode = 'grid' | 'bay' | 'none';

	const mode = $derived.by<Mode>(() => {
		const grids = layout.grids.length;
		const bays = layout.bays.length;
		if (grids <= MAX_GRID_TAGS) return 'grid';
		if (bays < grids && bays <= MAX_BAY_TAGS) return 'bay';
		return 'none';
	});

	/** Tag position above a box of cells: centred on x/y, `rise` metres over the top. */
	function above(
		min: { x: number; y: number },
		max: { x: number; y: number; z: number },
		rise: number
	): WorldTuple {
		const [x, y, z] = cellToWorld({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: max.z });
		return [x, y + rise, z];
	}

	const tags = $derived.by<Tag[]>(() => {
		const out: Tag[] = [];
		const nameOf = new Map(layout.grids.map(({ grid }) => [grid.id, grid.name]));

		if (mode === 'grid') {
			layout.grids.forEach(({ grid, origin }, index) => {
				// Alternate two heights so neighbouring tags do not sit on one line.
				const rise = index % 2 === 0 ? 0.6 : 2.1;
				const max = {
					x: origin.x + grid.cells.x,
					y: origin.y + grid.cells.y,
					z: origin.z + grid.cells.z
				};
				out.push({
					id: `grid:${grid.id}`,
					text: grid.name,
					kind: 'grid',
					position: above(origin, max, rise),
					active: grid.id === highlightGridId
				});
			});
		} else if (mode === 'bay') {
			for (const bay of layout.bays) {
				const highlighted = highlightGridId !== null && bay.gridIds.includes(highlightGridId);
				out.push({
					id: `bay:${bay.key}`,
					text: highlighted ? (nameOf.get(highlightGridId) ?? bay.label) : bay.label,
					kind: 'grid',
					position: above(bay.min, bay.max, 0.8),
					active: highlighted
				});
			}
		} else if (highlightGridId !== null) {
			const slot = layout.byId.get(highlightGridId);
			if (slot) {
				const { grid, origin } = slot;
				const max = {
					x: origin.x + grid.cells.x,
					y: origin.y + grid.cells.y,
					z: origin.z + grid.cells.z
				};
				out.push({
					id: `grid:${grid.id}`,
					text: grid.name,
					kind: 'grid',
					position: above(origin, max, 0.8),
					active: true
				});
			}
		}

		for (const { grid, origin } of layout.grids) {
			if (!grid.door) continue;
			const [ox, oy, oz] = cellToWorld(origin);
			const edge = doorEdge(grid.cells, grid.door);
			out.push({
				id: `door:${grid.id}`,
				text: 'RAMP',
				kind: 'door',
				position: [
					ox + edge.center[0] + edge.inward[0] * 0.4,
					oy + 0.02,
					oz + edge.center[1] + edge.inward[1] * 0.4
				],
				active: grid.id === highlightGridId
			});
		}
		return out;
	});
</script>

{#each tags as tag (tag.id)}
	<HTML position={tag.position} center pointerEvents="none">
		<span
			class={[
				'hold-label',
				tag.kind === 'door' ? 'hold-label--door' : 'hold-label--grid',
				tag.active && 'hold-label--active'
			]}>{tag.text}</span
		>
	</HTML>
{/each}
