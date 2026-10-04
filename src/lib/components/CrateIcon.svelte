<script lang="ts">
	/**
	 * Isometric stencil crate for one container size, drawn proportionally from
	 * CONTAINER_CELLS (x long, y deep, z high). Decorative; the label lives in HTML.
	 */
	import { CONTAINER_CELLS, type ContainerSize } from '../data/types.ts';

	let {
		size,
		color = 'currentColor',
		unit = 9,
		label = true
	}: {
		size: ContainerSize;
		/** Stroke colour (CSS). */
		color?: string;
		/** Pixels per cell edge. */
		unit?: number;
		/** Print the SCU number on the front face. */
		label?: boolean;
	} = $props();

	// 30° isometric projection: x goes right-down, y goes right-up, z goes up.
	const cx = Math.cos(Math.PI / 6);
	const cy = Math.sin(Math.PI / 6);
	const dims = $derived(CONTAINER_CELLS[size]);
	const geo = $derived.by(() => {
		const u = unit;
		const w = dims.x * u;
		const d = dims.y * u;
		const h = dims.z * u;
		const px = (x: number, y: number, z: number) => ({
			x: (x + y) * cx,
			y: (x - y) * cy - z
		});
		const pts = {
			a: px(0, 0, 0),
			b: px(w, 0, 0),
			c: px(w, d, 0),
			d: px(0, d, 0),
			e: px(0, 0, h),
			f: px(w, 0, h),
			g: px(w, d, h),
			hh: px(0, d, h)
		};
		const all = Object.values(pts);
		const minX = Math.min(...all.map((p) => p.x));
		const maxX = Math.max(...all.map((p) => p.x));
		const minY = Math.min(...all.map((p) => p.y));
		const maxY = Math.max(...all.map((p) => p.y));
		const pad = 2.5;
		const P = (p: { x: number; y: number }) =>
			`${(p.x - minX + pad).toFixed(2)} ${(p.y - minY + pad).toFixed(2)}`;
		const top = `M${P(pts.e)}L${P(pts.f)}L${P(pts.g)}L${P(pts.hh)}Z`;
		const front = `M${P(pts.a)}L${P(pts.b)}L${P(pts.f)}L${P(pts.e)}Z`;
		const side = `M${P(pts.b)}L${P(pts.c)}L${P(pts.g)}L${P(pts.f)}Z`;
		// Strap lines on the front face at cell boundaries.
		const straps: string[] = [];
		for (let i = 1; i < dims.x; i++) {
			straps.push(`M${P(px((i * w) / dims.x, 0, 0))}L${P(px((i * w) / dims.x, 0, h))}`);
		}
		for (let i = 1; i < dims.y; i++) {
			straps.push(`M${P(px(w, (i * d) / dims.y, 0))}L${P(px(w, (i * d) / dims.y, h))}`);
		}
		const frontCenter = px(w / 2, 0, h / 2);
		return {
			width: maxX - minX + pad * 2,
			height: maxY - minY + pad * 2,
			top,
			front,
			side,
			straps: straps.join(''),
			labelX: frontCenter.x - minX + pad,
			labelY: frontCenter.y - minY + pad
		};
	});
</script>

<svg
	class="crate"
	viewBox={`0 0 ${geo.width} ${geo.height}`}
	width={geo.width}
	height={geo.height}
	aria-hidden="true"
	style={`color:${color}`}
>
	<path
		d={geo.top}
		fill="currentColor"
		fill-opacity="0.22"
		stroke="currentColor"
		stroke-width="1.1"
		stroke-linejoin="round"
	/>
	<path
		d={geo.front}
		fill="currentColor"
		fill-opacity="0.1"
		stroke="currentColor"
		stroke-width="1.1"
		stroke-linejoin="round"
	/>
	<path
		d={geo.side}
		fill="#000"
		fill-opacity="0.28"
		stroke="currentColor"
		stroke-width="1.1"
		stroke-linejoin="round"
	/>
	<path d={geo.straps} stroke="currentColor" stroke-width="0.6" stroke-opacity="0.55" fill="none" />
	{#if label && size >= 4}
		<text
			x={geo.labelX}
			y={geo.labelY}
			text-anchor="middle"
			dominant-baseline="central"
			font-size={unit * 0.95}
			font-family="var(--font-body)"
			font-weight="700"
			fill="currentColor">{size}</text
		>
	{/if}
</svg>

<style>
	.crate {
		display: block;
		flex-shrink: 0;
		overflow: visible;
	}
</style>
