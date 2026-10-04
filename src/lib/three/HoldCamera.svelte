<script lang="ts">
	/**
	 * Perspective three-quarter view from the door side, or an axis-aligned
	 * orthographic top view. Both use CameraControls (touch, damping) and are
	 * re-fitted to the hold bounds whenever `fitKey` or the view changes.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { CameraControls, CameraControlsRef } from '@threlte/extras';
	import { fromStore } from 'svelte/store';
	import { untrack } from 'svelte';
	import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
	import { boundsCenter, boundsRadius, boundsSize, type WorldBounds } from './space.ts';

	interface Props {
		view: 'perspective' | 'top';
		bounds: WorldBounds;
		/** Changes to this value (e.g. the ship slug) trigger a re-fit. */
		fitKey: string;
	}

	let { view, bounds, fitKey }: Props = $props();

	const { size: sizeStore } = useThrelte();
	const size = fromStore(sizeStore);

	/** Polar angle from +y: ~36° above the floor so the floor lattice stays readable. */
	const POLAR = 0.95;
	const TOP_HEIGHT_M = 120;

	type Controls = InstanceType<typeof CameraControlsRef>;
	let controls = $state<Controls>();
	let lastFit = '';

	const center = $derived(boundsCenter(bounds));
	const radius = $derived(Math.max(2, boundsRadius(bounds)));
	/**
	 * Azimuth from +z (the door side) towards +x. A roughly square hold gets a
	 * proper three-quarter view; a long row of schematic grids gets a flatter
	 * angle so the row stays legible instead of receding diagonally.
	 */
	const azimuth = $derived.by(() => {
		const [w, , d] = boundsSize(bounds);
		const ratio = Math.min(1, Math.max(0.05, d / Math.max(w, 0.001)));
		return 0.22 + (0.62 - 0.22) * Math.sqrt(ratio);
	});

	/**
	 * camera-controls' fitToBox snaps the view to the nearest axis, so fit by
	 * hand: project the eight corners of the bounds into the camera frame for
	 * the chosen direction and take the smallest distance at which all of them
	 * are inside the frustum, plus a little breathing room.
	 */
	function fitPerspective(c: Controls) {
		const camera = c.camera;
		if (!(camera instanceof PerspectiveCamera)) return;
		const { width, height } = size.current;
		const tanV = Math.tan(((camera.fov / 2) * Math.PI) / 180);
		const tanH = tanV * (width / Math.max(height, 1));
		const dir = new Vector3().setFromSphericalCoords(1, POLAR, azimuth);
		const toCamera = new Quaternion()
			.setFromRotationMatrix(new Matrix4().lookAt(dir, new Vector3(), new Vector3(0, 1, 0)))
			.invert();
		const [cx, cy, cz] = center;
		let distance = 0;
		const corner = new Vector3();
		for (let i = 0; i < 8; i++) {
			corner
				.set(
					(i & 1 ? bounds.max[0] : bounds.min[0]) - cx,
					(i & 2 ? bounds.max[1] : bounds.min[1]) - cy,
					(i & 4 ? bounds.max[2] : bounds.min[2]) - cz
				)
				.applyQuaternion(toCamera);
			// Camera-space z points towards the viewer; the corner sits at depth (distance - z).
			distance = Math.max(
				distance,
				Math.abs(corner.x) / tanH + corner.z,
				Math.abs(corner.y) / tanV + corner.z
			);
		}
		distance = Math.max(distance * 1.12, radius * 0.5);
		c.minDistance = radius * 0.3;
		c.maxDistance = Math.max(distance * 4, radius * 8);
		void c.setLookAt(
			cx + dir.x * distance,
			cy + dir.y * distance,
			cz + dir.z * distance,
			cx,
			cy,
			cz,
			false
		);
	}

	function fitTop(c: Controls) {
		const [w, , d] = boundsSize(bounds);
		const { width, height } = size.current;
		const zoom = Math.min(width / Math.max(w, 1), height / Math.max(d, 1)) * 0.82;
		c.minZoom = zoom * 0.3;
		c.maxZoom = zoom * 8;
		void c.setLookAt(center[0], TOP_HEIGHT_M, center[2], center[0], 0, center[2], false);
		void c.zoomTo(zoom, false);
	}

	$effect(() => {
		const c = controls;
		const { width, height } = size.current;
		// The size is part of the key so a rotated phone or resized window re-frames the hold.
		const key = `${fitKey}|${view}|${Math.round(width)}x${Math.round(height)}`;
		const ready = width > 0 && height > 0;
		if (!c || !ready || lastFit === key) return;
		lastFit = key;
		untrack(() => (view === 'top' ? fitTop(c) : fitPerspective(c)));
	});
</script>

{#if view === 'top'}
	<T.OrthographicCamera
		makeDefault
		near={1}
		far={400}
		position={[center[0], TOP_HEIGHT_M, center[2]]}
	>
		<CameraControls
			bind:ref={controls}
			minPolarAngle={0}
			maxPolarAngle={0}
			smoothTime={0.18}
			draggingSmoothTime={0.08}
			dollyToCursor
			oncreate={(c) => {
				// Left drag pans in the top view; rotation is locked anyway.
				c.mouseButtons.left = CameraControlsRef.ACTION.TRUCK;
				c.touches.one = CameraControlsRef.ACTION.TOUCH_TRUCK;
			}}
		/>
	</T.OrthographicCamera>
{:else}
	<T.PerspectiveCamera
		makeDefault
		fov={32}
		near={0.3}
		far={600}
		position={[center[0] + radius * 2, center[1] + radius * 1.4, center[2] + radius * 2.4]}
	>
		<CameraControls
			bind:ref={controls}
			minPolarAngle={0.12}
			maxPolarAngle={Math.PI / 2 - 0.04}
			smoothTime={0.22}
			draggingSmoothTime={0.1}
			dollyToCursor
		/>
	</T.PerspectiveCamera>
{/if}
