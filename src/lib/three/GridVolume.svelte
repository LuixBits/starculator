<script lang="ts">
	/**
	 * One cargo grid: a translucent cyan box with glowing edges, a thin lattice
	 * on the floor face only (one LineSegments per grid) and a magenta chevron
	 * strip on the floor along the door edge. Grids without a curated door show
	 * the packer's default face (doorOf) at reduced opacity, so the side the
	 * load plan is built from is always visible and recognisably "assumed".
	 *
	 * Local frame: origin at the grid's minimum corner; the grid spans
	 * x ∈ [0, W], y ∈ [0, H], z ∈ [-D, 0] (see space.ts).
	 */
	import { T } from '@threlte/core';
	import {
		BoxGeometry,
		BufferGeometry,
		EdgesGeometry,
		Float32BufferAttribute,
		Shape,
		ShapeGeometry,
		PlaneGeometry
	} from 'three';
	import { CELL_M } from '../data/types.ts';
	import type { CargoGrid } from '../data/types.ts';
	import { doorOf } from '../packer/geometry.ts';
	import { SCENE_COLORS } from './palette.ts';
	import { cellSizeToWorld, doorEdge, type WorldTuple } from './space.ts';

	interface Props {
		grid: CargoGrid;
		/** World position of the grid's minimum corner. */
		position: WorldTuple;
		highlighted?: boolean;
	}

	let { grid, position, highlighted = false }: Props = $props();

	const size = $derived(cellSizeToWorld(grid.cells));
	const [w, h, d] = $derived(size);

	// Geometry is rebuilt only when the cell counts change (keyed by size).
	const box = $derived(new BoxGeometry(w, h, d));
	const edges = $derived(new EdgesGeometry(box));
	const lattice = $derived(buildLattice(grid.cells.x, grid.cells.y));
	const door = $derived(doorEdge(grid.cells, doorOf(grid)));
	const assumed = $derived(grid.door === null);
	const strip = $derived(new PlaneGeometry(door.length, CELL_M * 0.5));
	const chevrons = $derived(buildChevrons(door.cells));

	$effect(() => {
		const owned = [box, edges, lattice, strip, chevrons];
		return () => owned.forEach((g) => g.dispose());
	});

	/** Lines every cell on the floor face, in local coordinates. */
	function buildLattice(cellsX: number, cellsY: number): BufferGeometry {
		const verts: number[] = [];
		const width = cellsX * CELL_M;
		const depth = cellsY * CELL_M;
		for (let i = 0; i <= cellsX; i++) {
			const x = i * CELL_M;
			verts.push(x, 0, 0, x, 0, -depth);
		}
		for (let j = 0; j <= cellsY; j++) {
			const z = -j * CELL_M;
			verts.push(0, 0, z, width, 0, z);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
		return geometry;
	}

	/**
	 * One chevron per cell along the door edge, drawn in the XY plane with the
	 * tip at +y; the mesh is rotated -90° about x so +y becomes local -z (into
	 * the grid), and the group's rotationY turns it onto the right edge.
	 */
	function buildChevrons(count: number): ShapeGeometry {
		const span = CELL_M * 0.62;
		const rise = CELL_M * 0.3;
		const thick = CELL_M * 0.11;
		const shapes: Shape[] = [];
		for (let i = 0; i < count; i++) {
			const cx = (i + 0.5) * CELL_M - (count * CELL_M) / 2;
			const base = CELL_M * 0.12;
			const s = new Shape();
			s.moveTo(cx - span / 2, base);
			s.lineTo(cx, base + rise);
			s.lineTo(cx + span / 2, base);
			s.lineTo(cx + span / 2, base - thick);
			s.lineTo(cx, base + rise - thick);
			s.lineTo(cx - span / 2, base - thick);
			s.closePath();
			shapes.push(s);
		}
		return new ShapeGeometry(shapes);
	}

	const fillOpacity = $derived(highlighted ? 0.16 : 0.06);
	const edgeOpacity = $derived(highlighted ? 1 : 0.6);
	const edgeColor = $derived(highlighted ? SCENE_COLORS.fg : SCENE_COLORS.accent2);
	const stripOpacity = $derived(assumed ? 0.12 : 0.22);
	const chevronOpacity = $derived(assumed ? 0.5 : 0.9);
</script>

<T.Group {position}>
	<T.Mesh position={[w / 2, h / 2, -d / 2]} geometry={box} renderOrder={2}>
		<T.MeshBasicMaterial
			color={SCENE_COLORS.accent2}
			transparent
			opacity={fillOpacity}
			depthWrite={false}
		/>
	</T.Mesh>

	<T.LineSegments position={[w / 2, h / 2, -d / 2]} geometry={edges} renderOrder={3}>
		<T.LineBasicMaterial color={edgeColor} transparent opacity={edgeOpacity} />
	</T.LineSegments>

	<T.LineSegments geometry={lattice} position.y={0.008} renderOrder={1}>
		<T.LineBasicMaterial
			color={SCENE_COLORS.accent2}
			transparent
			opacity={highlighted ? 0.55 : 0.32}
		/>
	</T.LineSegments>

	<T.Group position={[door.center[0], 0.014, door.center[1]]} rotation.y={door.rotationY}>
		<T.Mesh geometry={strip} rotation.x={-Math.PI / 2} position.z={-CELL_M * 0.25} renderOrder={1}>
			<T.MeshBasicMaterial
				color={SCENE_COLORS.accent}
				transparent
				opacity={stripOpacity}
				depthWrite={false}
			/>
		</T.Mesh>
		<T.Mesh geometry={chevrons} rotation.x={-Math.PI / 2} position.y={0.004} renderOrder={1}>
			<T.MeshBasicMaterial
				color={SCENE_COLORS.accent}
				transparent
				opacity={chevronOpacity}
				depthWrite={false}
			/>
		</T.Mesh>
	</T.Group>
</T.Group>
