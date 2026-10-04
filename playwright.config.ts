import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Mirror vite.config.ts: use a preinstalled Chromium when the image provides one
// (CI, the cloud dev sandbox), otherwise let Playwright resolve its own download.
const preinstalledChromium =
	process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined;

const isCI = Boolean(process.env.CI);
const port = 4173;

// The specs exercise the static build (adapter-static, every /cargo/<ship>/ page
// prerendered), so the server is `vite preview` over build/. A pipeline that has
// already run `pnpm build` (the CI workflow does) sets E2E_PREBUILT=1 to skip the
// rebuild; nothing else may write to build/ or .svelte-kit/ while this runs.
const serverCommand = process.env.E2E_PREBUILT
	? `pnpm preview --port ${port}`
	: `pnpm build && pnpm preview --port ${port}`;

export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results',
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	reporter: isCI ? [['list'], ['github']] : 'list',
	webServer: {
		command: serverCommand,
		port,
		reuseExistingServer: !isCI,
		// A cold `vite build` of every ship page plus the preview start-up.
		timeout: 180_000
	},
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		trace: 'on-first-retry',
		launchOptions: {
			executablePath,
			// Headless Chromium has no GPU: force software WebGL so the Threlte hold
			// renders and 3D click selection can be tested (same flags as
			// scripts/screenshot.mjs).
			args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
		}
	}
});
