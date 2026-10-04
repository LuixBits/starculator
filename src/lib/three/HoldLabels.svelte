<script lang="ts">
	/**
	 * HTML overlays: one name tag above each grid and a "RAMP" tag at each door.
	 * Only class names are set; the host page styles `.hold-label`.
	 */
	import { HTML } from '@threlte/extras';
	import { CELL_M } from '../data/types.ts';
	import type { HoldLayout } from './layout.ts';
	import { cellToWorld, doorEdge, type WorldTuple } from './space.ts';

	interface Props {
		layout: HoldLayout;
		highlightGridId?: string | null;
	}

	let { layout, highlightGridId = null }: Props = $props();

	interface Tag {
		id: string;
		text: string;
		kind: 'grid' | 'door';
		position: WorldTuple;
		active: boolean;
	}

	const tags = $derived.by<Tag[]>(() => {
		const out: Tag[] = [];
		layout.grids.forEach(({ grid, origin }, index) => {
			const active = grid.id === highlightGridId;
			const [ox, oy, oz] = cellToWorld(origin);
			// Alternate two heights so neighbouring tags do not sit on one line.
			const rise = index % 2 === 0 ? 0.6 : 2.1;
			out.push({
				id: `grid:${grid.id}`,
				text: grid.name,
				kind: 'grid',
				position: [
					ox + (grid.cells.x * CELL_M) / 2,
					oy + grid.cells.z * CELL_M + rise,
					oz - (grid.cells.y * CELL_M) / 2
				],
				active
			});
			if (grid.door) {
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
					active
				});
			}
		});
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
