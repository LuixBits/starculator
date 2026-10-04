<script lang="ts">
	/**
	 * HTML overlays: name tags above the hold and "RAMP" tags at the doors.
	 * Only class names are set; the host page styles `.hold-label`.
	 *
	 * Density (labels.ts): up to MAX_GRID_TAGS grids get one full-name tag
	 * each; otherwise, when the ship has bays, one tag per bay; otherwise every
	 * grid gets a compact abbreviation (M1, O1, …) so a Hull C or an Idris
	 * stays readable instead of going silent. The highlighted grid always shows
	 * its full name. Door tags follow the same density; a tag for a grid whose
	 * door is not curated (the packer's default) carries `hold-label--assumed`.
	 */
	import { HTML } from '@threlte/extras';
	import type { HoldLayout } from './layout.ts';
	import { abbreviateGridNames, doorSites, labelMode, type DoorSite } from './labels.ts';
	import { cellToWorld, doorEdge, type CellPoint, type WorldTuple } from './space.ts';

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
		compact: boolean;
		assumed: boolean;
	}

	const mode = $derived(labelMode(layout.grids.length, layout.bays.length));

	/** Tag position above a box of cells: centred on x/y, `rise` metres over the top. */
	function above(min: CellPoint, max: CellPoint, rise: number): WorldTuple {
		const [x, y, z] = cellToWorld({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: max.z });
		return [x, y + rise, z];
	}

	/** Just inside the door edge of a box of cells, on the floor. */
	function atDoor(site: DoorSite): WorldTuple {
		const [ox, oy, oz] = cellToWorld(site.min);
		const edge = doorEdge(
			{ x: site.max.x - site.min.x, y: site.max.y - site.min.y, z: site.max.z - site.min.z },
			site.face
		);
		return [
			ox + edge.center[0] + edge.inward[0] * 0.4,
			oy + 0.02,
			oz + edge.center[1] + edge.inward[1] * 0.4
		];
	}

	function maxOf(origin: CellPoint, cells: CellPoint): CellPoint {
		return { x: origin.x + cells.x, y: origin.y + cells.y, z: origin.z + cells.z };
	}

	const nameTags = $derived.by<Tag[]>(() => {
		const out: Tag[] = [];
		if (mode === 'bay') {
			const nameOf = new Map(layout.grids.map(({ grid }) => [grid.id, grid.name]));
			for (const bay of layout.bays) {
				const highlighted = highlightGridId !== null && bay.gridIds.includes(highlightGridId);
				out.push({
					id: `bay:${bay.key}`,
					text: highlighted ? (nameOf.get(highlightGridId) ?? bay.label) : bay.label,
					kind: 'grid',
					position: above(bay.min, bay.max, 0.8),
					active: highlighted,
					compact: false,
					assumed: false
				});
			}
			return out;
		}
		const compact = mode === 'compact';
		const short = compact ? abbreviateGridNames(layout.grids.map(({ grid }) => grid.name)) : null;
		layout.grids.forEach(({ grid, origin }, index) => {
			const active = grid.id === highlightGridId;
			// Alternate two heights so neighbouring tags do not sit on one line.
			const rise = compact ? (index % 2 === 0 ? 0.5 : 1.5) : index % 2 === 0 ? 0.6 : 2.1;
			out.push({
				id: `grid:${grid.id}`,
				text: short && !active ? short[index] : grid.name,
				kind: 'grid',
				position: above(origin, maxOf(origin, grid.cells), rise),
				active,
				compact: compact && !active,
				assumed: false
			});
		});
		return out;
	});

	const doorTags = $derived.by<Tag[]>(() =>
		doorSites(layout, mode, highlightGridId).map((site) => ({
			id: site.id,
			text: 'RAMP',
			kind: 'door',
			position: atDoor(site),
			active: site.active,
			compact: false,
			assumed: site.assumed
		}))
	);

	const tags = $derived([...nameTags, ...doorTags]);
</script>

{#each tags as tag (tag.id)}
	<HTML position={tag.position} center pointerEvents="none">
		<span
			class={[
				'hold-label',
				tag.kind === 'door' ? 'hold-label--door' : 'hold-label--grid',
				tag.compact && 'hold-label--compact',
				tag.assumed && 'hold-label--assumed',
				tag.active && 'hold-label--active'
			]}
			data-assumed={tag.assumed ? 'true' : undefined}>{tag.text}</span
		>
	</HTML>
{/each}
