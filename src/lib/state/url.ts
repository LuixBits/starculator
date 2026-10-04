/**
 * Compact URL codec for a plan: `?g=Contract%20A:32x4,16x2;Contract%20B:8x6&v=top`.
 * Group segments are separated by ";", label and counts by ":", counts by ",".
 * Labels escape only the three delimiters (and "%"), so the query stays readable.
 */
import { CONTAINER_SIZES } from '../data/types.ts';
import {
	SNAPSHOT_VERSION,
	clampCount,
	defaultGroupLabel,
	emptyCounts,
	isContainerSize,
	type GroupSnapshot,
	type PlanSnapshot,
	type ViewMode
} from './snapshot.ts';

export const URL_PARAM_GROUPS = 'g';
export const URL_PARAM_VIEW = 'v';

function escapeLabel(label: string): string {
	return label.replace(/%/g, '%25').replace(/:/g, '%3A').replace(/;/g, '%3B').replace(/,/g, '%2C');
}

function unescapeLabel(label: string): string {
	return label
		.replace(/%3A/gi, ':')
		.replace(/%3B/gi, ';')
		.replace(/%2C/gi, ',')
		.replace(/%25/g, '%');
}

function encodeGroup(group: GroupSnapshot): string {
	const counts = CONTAINER_SIZES.filter((size) => group.counts[size] > 0)
		.sort((a, b) => b - a)
		.map((size) => `${size}x${group.counts[size]}`)
		.join(',');
	return `${escapeLabel(group.label)}:${counts}`;
}

/** Encodes only what carries information: groups with boxes and a non-default view. */
export function encodePlan(plan: PlanSnapshot): URLSearchParams {
	const params = new URLSearchParams();
	const groups = plan.groups.filter((g) => CONTAINER_SIZES.some((size) => g.counts[size] > 0));
	if (groups.length > 0) params.set(URL_PARAM_GROUPS, groups.map(encodeGroup).join(';'));
	if (plan.view !== 'orbit') params.set(URL_PARAM_VIEW, plan.view);
	return params;
}

/** Full shareable query string including the leading "?" (or "" when empty). */
export function encodePlanQuery(plan: PlanSnapshot): string {
	const q = encodePlan(plan).toString();
	return q ? `?${q}` : '';
}

function decodeGroup(segment: string, index: number): GroupSnapshot | null {
	const colon = segment.lastIndexOf(':');
	const rawLabel = colon >= 0 ? segment.slice(0, colon) : '';
	const rawCounts = colon >= 0 ? segment.slice(colon + 1) : segment;
	const counts = emptyCounts();
	let any = false;
	for (const pair of rawCounts.split(',')) {
		const m = /^(\d+)x(\d+)$/.exec(pair.trim());
		if (!m) continue;
		const size = Number(m[1]);
		const n = clampCount(Number(m[2]));
		if (isContainerSize(size) && n > 0) {
			counts[size] = n;
			any = true;
		}
	}
	if (!any && !rawLabel) return null;
	const label = unescapeLabel(rawLabel).trim().slice(0, 40) || defaultGroupLabel(index);
	return { id: `g${index + 1}`, label, colorIndex: index % 7, unloadOrder: index, counts };
}

/** Anything with URLSearchParams' `get`, including SvelteKit's read-only variant. */
export interface QueryReader {
	get(name: string): string | null;
}

/** Returns null when the query carries no plan at all. */
export function decodePlan(params: QueryReader, shipSlug: string): PlanSnapshot | null {
	const g = params.get(URL_PARAM_GROUPS);
	const v = params.get(URL_PARAM_VIEW);
	if (g === null && v === null) return null;
	const groups: GroupSnapshot[] = [];
	if (g) {
		for (const segment of g.split(';')) {
			if (groups.length >= 4) break;
			const decoded = decodeGroup(segment, groups.length);
			if (decoded) groups.push(decoded);
		}
	}
	const view: ViewMode = v === 'top' ? 'top' : 'orbit';
	return { version: SNAPSHOT_VERSION, shipSlug, groups, view };
}
