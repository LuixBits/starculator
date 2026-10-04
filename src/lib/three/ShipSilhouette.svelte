<script lang="ts">
	/**
	 * Wireframe hull bounding box for scale: width × height × length from the
	 * ship data, centred on the laid-out grids. No game mesh is involved.
	 */
	import { T } from '@threlte/core';
	import { BoxGeometry, EdgesGeometry } from 'three';
	import type { Ship } from '../data/types.ts';
	import { SCENE_COLORS } from './palette.ts';
	import type { WorldTuple } from './space.ts';

	interface Props {
		ship: Ship;
		/** Centre of the hull box in world metres. */
		center: WorldTuple;
	}

	let { ship, center }: Props = $props();

	const size = $derived<WorldTuple>([ship.dimensions.x, ship.dimensions.z, ship.dimensions.y]);
	const edges = $derived(new EdgesGeometry(new BoxGeometry(...size)));

	$effect(() => {
		const g = edges;
		return () => g.dispose();
	});
</script>

<T.LineSegments position={center} geometry={edges}>
	<T.LineBasicMaterial color={SCENE_COLORS.metal} transparent opacity={0.25} />
</T.LineSegments>
