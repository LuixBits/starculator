import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const REPOSITORY = 'https://github.com/StarCitizenWiki/scunpacked-data';

export function shipsJsonUrl(sha: string): string {
	return `https://raw.githubusercontent.com/StarCitizenWiki/scunpacked-data/${sha}/ships.json`;
}

export function cacheFileFor(cacheDir: string, sha: string): string {
	return path.join(cacheDir, `scunpacked-ships-${sha}.json`);
}

async function exists(file: string): Promise<boolean> {
	try {
		await stat(file);
		return true;
	} catch {
		return false;
	}
}

export interface FetchOptions {
	sha: string;
	cacheDir: string;
	/** An existing copy of ships.json to seed the cache from instead of downloading. */
	seedFrom?: string;
	log?: (line: string) => void;
}

/**
 * Returns the raw ships.json array for the pinned commit, downloading it once
 * and caching it under cacheDir so re-runs are offline.
 */
export async function fetchShipsJson(options: FetchOptions): Promise<unknown[]> {
	const log = options.log ?? (() => {});
	const cacheFile = cacheFileFor(options.cacheDir, options.sha);
	await mkdir(options.cacheDir, { recursive: true });

	if (!(await exists(cacheFile))) {
		if (options.seedFrom && (await exists(options.seedFrom))) {
			log(`seeding cache from ${options.seedFrom}`);
			await copyFile(options.seedFrom, cacheFile);
		} else {
			const url = shipsJsonUrl(options.sha);
			log(`downloading ${url}`);
			const response = await fetch(url);
			if (!response.ok)
				throw new Error(`download failed: ${response.status} ${response.statusText} for ${url}`);
			const text = await response.text();
			parseArray(text, url);
			await writeFile(cacheFile, text);
			log(`cached ${(text.length / 1e6).toFixed(1)} MB at ${cacheFile}`);
		}
	} else {
		log(`using cached ${cacheFile}`);
	}
	return parseArray(await readFile(cacheFile, 'utf8'), cacheFile);
}

function parseArray(text: string, source: string): unknown[] {
	const parsed: unknown = JSON.parse(text);
	if (!Array.isArray(parsed)) throw new Error(`${source} is not a JSON array`);
	return parsed;
}
