#!/usr/bin/env node
/**
 * Ship data pipeline: scunpacked-data ships.json → src/lib/data/generated/.
 *
 *   node scripts/ingest-ships.ts [--sha <commit>] [--version <game build>] [--date <iso>]
 *                                [--cache-dir <dir>] [--seed <ships.json copy>]
 *                                [--out <dir>] [--ingested-at <iso>]
 *
 * The download is cached per commit SHA so re-runs are offline. Output is
 * deterministic (fixed key order, 2-space JSON): meta.ingestedAt is only
 * renewed when some other output byte changed, so a re-run over unchanged data
 * leaves `git diff src/lib/data/generated` empty. --ingested-at pins it.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { applyOverrides, hiddenClassNames, parseOverrides } from '#lib/data/overrides.ts';
import type { VariantEntry } from '#lib/data/ships.ts';
import type { CargoGrid, DataMeta, Ship, ShipIndexEntry } from '#lib/data/types.ts';
import { REPOSITORY, fetchShipsJson } from './ingest/download.ts';
import { normalizeVehicle } from './ingest/normalize.ts';
import { hasCargoGrids, isRawVehicle, type RawVehicle } from './ingest/raw.ts';
import { PREFERRED_REPRESENTATIVES } from './ingest/representatives.ts';
import { assignSlugs, foldVariants } from './ingest/variants.ts';

const DEFAULTS = {
	sha: 'e96132078ae6a1a5f62a183fb1523dc006dcfddb',
	version: '4.10.1-LIVE.12660092',
	date: '2026-09-22T09:01:51+02:00'
};

const root = path.resolve(import.meta.dirname, '..');

const { values: args } = parseArgs({
	options: {
		sha: { type: 'string', default: DEFAULTS.sha },
		version: { type: 'string', default: DEFAULTS.version },
		date: { type: 'string', default: DEFAULTS.date },
		'cache-dir': {
			type: 'string',
			default: path.join(root, 'node_modules', '.cache', 'scunpacked')
		},
		seed: { type: 'string' },
		out: { type: 'string', default: path.join(root, 'src', 'lib', 'data', 'generated') },
		'ingested-at': { type: 'string' }
	}
});

const log = (line: string): void => console.error(line);

/* ---------- canonical (key-ordered) output shapes ---------- */

function canonicalGrid(g: CargoGrid): CargoGrid {
	return {
		id: g.id,
		name: g.name,
		className: g.className,
		cells: { x: g.cells.x, y: g.cells.y, z: g.cells.z },
		meters: { x: g.meters.x, y: g.meters.y, z: g.meters.z },
		scu: g.scu,
		minBox: g.minBox && { x: g.minBox.x, y: g.minBox.y, z: g.minBox.z },
		maxBox: g.maxBox && { x: g.maxBox.x, y: g.maxBox.y, z: g.maxBox.z },
		allowedSizes: [...g.allowedSizes].sort((a, b) => a - b),
		external: g.external,
		hardpoint: g.hardpoint,
		bay: g.bay,
		offset: g.offset && { x: g.offset.x, y: g.offset.y, z: g.offset.z },
		door: g.door
	};
}

function canonicalShip(s: Ship): Ship {
	return {
		slug: s.slug,
		name: s.name,
		fullName: s.fullName,
		className: s.className,
		uuid: s.uuid,
		manufacturer: { code: s.manufacturer.code, name: s.manufacturer.name },
		size: s.size,
		role: s.role,
		career: s.career,
		dimensions: { x: s.dimensions.x, y: s.dimensions.y, z: s.dimensions.z },
		cargoScu: s.cargoScu,
		grids: s.grids.map(canonicalGrid),
		maxContainer: s.maxContainer,
		isSpaceship: s.isSpaceship,
		isGroundVehicle: s.isGroundVehicle,
		variantOf: s.variantOf,
		variants: [...s.variants]
	};
}

function indexEntry(s: Ship): ShipIndexEntry {
	return {
		slug: s.slug,
		name: s.name,
		fullName: s.fullName,
		manufacturer: { code: s.manufacturer.code, name: s.manufacturer.name },
		size: s.size,
		role: s.role,
		cargoScu: s.cargoScu,
		gridCount: s.grids.length,
		maxContainer: s.maxContainer,
		isGroundVehicle: s.isGroundVehicle
	};
}

function compareIndex(a: ShipIndexEntry, b: ShipIndexEntry): number {
	return (
		a.manufacturer.name.localeCompare(b.manufacturer.name, 'en') ||
		a.name.localeCompare(b.name, 'en', { numeric: true }) ||
		a.slug.localeCompare(b.slug, 'en')
	);
}

function toJson(value: unknown): string {
	return JSON.stringify(value, null, 2) + '\n';
}

async function readText(file: string): Promise<string | null> {
	try {
		return await readFile(file, 'utf8');
	} catch (error: unknown) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

/** Relative output path → serialised content, for every file except meta.json. */
type OutputFiles = Map<string, string>;

/** True when every output file (and no other ship file) is already on disk byte for byte. */
async function outputsUnchanged(outDir: string, files: OutputFiles): Promise<boolean> {
	for (const [rel, content] of files)
		if ((await readText(path.join(outDir, rel))) !== content) return false;
	const existing = await readdir(path.join(outDir, 'ships')).catch(() => [] as string[]);
	return existing.every((f) => !f.endsWith('.json') || files.has(`ships/${f}`));
}

/**
 * The previous run's timestamp when nothing else changed, else now. An
 * unchanged meta.json (ignoring its own ingestedAt) is part of "nothing".
 */
async function resolveIngestedAt(
	outDir: string,
	files: OutputFiles,
	meta: Omit<DataMeta, 'ingestedAt'>
): Promise<string> {
	if (args['ingested-at']) return args['ingested-at'];
	const previousText = await readText(path.join(outDir, 'meta.json'));
	const previous: unknown = previousText === null ? null : JSON.parse(previousText);
	if (typeof previous !== 'object' || previous === null) return new Date().toISOString();
	const { ingestedAt, ...rest } = previous as Partial<DataMeta>;
	const sameMeta = toJson(rest) === toJson(meta);
	if (typeof ingestedAt === 'string' && sameMeta && (await outputsUnchanged(outDir, files)))
		return ingestedAt;
	return new Date().toISOString();
}

/* ---------- main ---------- */

async function main(): Promise<void> {
	const rawList = await fetchShipsJson({
		sha: args.sha,
		cacheDir: args['cache-dir'],
		seedFrom: args.seed,
		log
	});

	const vehicles: RawVehicle[] = [];
	for (const entry of rawList) {
		if (!isRawVehicle(entry))
			throw new Error(`unexpected vehicle shape: ${JSON.stringify(entry).slice(0, 200)}`);
		vehicles.push(entry);
	}
	const withGrids = vehicles.filter(hasCargoGrids);
	log(`vehicles: ${vehicles.length}, with cargo grids: ${withGrids.length}`);

	const overrides = parseOverrides(
		JSON.parse(await readFile(path.join(root, 'src/lib/data/overrides.json'), 'utf8'))
	);
	const hidden = hiddenClassNames(overrides);
	const visible = withGrids.filter((v) => !hidden.has(v.ClassName));

	const warnings: string[] = [];
	const normalized = visible.map((v) => {
		const result = normalizeVehicle(v);
		warnings.push(...result.warnings);
		return result.ship;
	});
	for (const className of PREFERRED_REPRESENTATIVES.keys())
		if (!normalized.some((s) => s.className === className))
			warnings.push(`preferred representative ${className} is not in the data (stale entry?)`);
	const slugged = assignSlugs(normalized);
	const { representatives, variants } = foldVariants(slugged);
	const { ships, applied } = applyOverrides(representatives, overrides);

	const index = ships.map(indexEntry).sort(compareIndex);
	const bySlug = new Map(ships.map((s) => [s.slug, canonicalShip(s)] as const));
	const gridCount = ships.reduce((sum, s) => sum + s.grids.length, 0);
	const metaBody: Omit<DataMeta, 'ingestedAt'> = {
		source: 'scunpacked-data',
		repository: REPOSITORY,
		commit: args.sha,
		gameVersion: args.version,
		publishedAt: args.date,
		shipCount: ships.length,
		gridCount
	};

	const files: OutputFiles = new Map([
		['index.json', toJson(index)],
		['variants.json', toJson(variants satisfies VariantEntry[])],
		...index.map((e) => [`ships/${e.slug}.json`, toJson(bySlug.get(e.slug))] as const)
	]);
	const ingestedAt = await resolveIngestedAt(args.out, files, metaBody);
	// Key order of DataMeta as documented: ingestedAt sits after publishedAt.
	const meta: DataMeta = {
		source: metaBody.source,
		repository: metaBody.repository,
		commit: metaBody.commit,
		gameVersion: metaBody.gameVersion,
		publishedAt: metaBody.publishedAt,
		ingestedAt,
		shipCount: metaBody.shipCount,
		gridCount: metaBody.gridCount
	};

	const shipsDir = path.join(args.out, 'ships');
	await mkdir(shipsDir, { recursive: true });
	for (const stale of await readdir(shipsDir))
		if (stale.endsWith('.json') && !bySlug.has(stale.slice(0, -5)))
			await rm(path.join(shipsDir, stale));
	await writeFile(path.join(args.out, 'meta.json'), toJson(meta));
	for (const [rel, content] of files) await writeFile(path.join(args.out, rel), content);

	for (const warning of warnings) log(`warn: ${warning}`);
	log(
		[
			`ships: ${ships.length} representatives (${gridCount} grids)`,
			`variants folded: ${variants.length}`,
			`hidden: ${withGrids.length - visible.length}`,
			`overrides applied: ${applied.length} (${applied.join(', ')})`,
			`warnings: ${warnings.length}`,
			`written to ${path.relative(root, args.out)}`
		].join('\n')
	);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
	process.exitCode = 1;
});
