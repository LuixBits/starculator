import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DepartureBoard from './DepartureBoard.svelte';
import { getShipIndex } from '../data/ships.ts';
import { getShipAliases } from '../state/adapters.ts';
import { formatScu } from '../ui/format.ts';

const index = getShipIndex();

describe('DepartureBoard', () => {
	it('renders one link per ship pointing at the planner', async () => {
		render(DepartureBoard, { entries: index });
		const links = page.getByRole('link', { name: /Caterpillar/ });
		await expect.element(links).toHaveAttribute('href', '/cargo/drake-caterpillar/');
		const rows = document.querySelectorAll('.rows a');
		expect(rows).toHaveLength(index.length);
	});

	it('filters by text and by the 32-SCU toggle', async () => {
		render(DepartureBoard, { entries: index });
		await page.getByRole('searchbox', { name: 'Search ships' }).fill('hull');
		await expect.element(page.getByRole('link', { name: /Hull A/ })).toBeInTheDocument();
		const hulls = index.filter((e) => /hull/i.test(e.fullName));
		expect(document.querySelectorAll('.rows a')).toHaveLength(hulls.length);
		await page.getByRole('checkbox', { name: /32-SCU/ }).click();
		expect(document.querySelectorAll('.rows a')).toHaveLength(
			hulls.filter((e) => e.maxContainer === 32).length
		);
		await expect.element(page.getByRole('link', { name: /Hull C/ })).toBeInTheDocument();
	});

	it('honours the row limit and offers the full board', async () => {
		render(DepartureBoard, { entries: index, limit: 3, moreHref: '/ships/' });
		expect(document.querySelectorAll('.rows a')).toHaveLength(3);
		await expect
			.element(page.getByRole('link', { name: /All departures/ }))
			.toHaveAttribute('href', '/ships/');
	});

	it('sorts by SCU when sortable', async () => {
		render(DepartureBoard, { entries: index, sortable: true, initialSort: 'scu' });
		const scuOfFirstRow = () => document.querySelector('.rows a .c-scu')?.textContent?.trim();
		const capacities = index.map((e) => e.cargoScu);
		expect(scuOfFirstRow()).toBe(formatScu(Math.max(...capacities)));
		await page.getByRole('columnheader', { name: /^SCU/ }).click();
		expect(scuOfFirstRow()).toBe(formatScu(Math.min(...capacities)));
	});

	it('finds a ship by a folded variant name and shows the alias', async () => {
		const aliases = getShipAliases();
		const [slug, names] = Object.entries(aliases)[0];
		render(DepartureBoard, { entries: index, aliases });
		await page.getByRole('searchbox', { name: 'Search ships' }).fill(names[0]);
		const row = document.querySelector(`.rows a[href="/cargo/${slug}/"]`);
		expect(row).not.toBeNull();
		expect(row?.querySelector('.aliases')?.textContent).toContain(names[0]);
	});
});
