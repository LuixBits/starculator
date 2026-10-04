const scuFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatScu(n: number): string {
	return scuFormat.format(n);
}

export function formatPercent(used: number, total: number): string {
	if (total <= 0) return '0%';
	return `${Math.round((used / total) * 100)}%`;
}

export function formatCells(cells: { x: number; y: number; z: number }): string {
	return `${cells.x}×${cells.y}×${cells.z}`;
}

export function formatMeters(m: { x: number; y: number; z: number }): string {
	const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, ''));
	return `${f(m.x)} × ${f(m.y)} × ${f(m.z)} m`;
}

/** Box numbers on tags read better zero-padded: #01, #02 … */
export function formatOrder(order: number, total: number): string {
	const digits = Math.max(2, String(total).length);
	return `#${String(order + 1).padStart(digits, '0')}`;
}

/** Packer timings: sub-millisecond runs keep one decimal, anything else is rounded. */
export function formatMs(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return '0 ms';
	return ms < 1 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}
