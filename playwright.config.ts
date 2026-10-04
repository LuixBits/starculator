import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const preinstalledChromium =
	process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined;

export default defineConfig({
	webServer: {
		command: 'pnpm build && pnpm preview --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'e2e',
	use: {
		launchOptions: executablePath ? { executablePath } : undefined
	}
});
