# Audit of the current `starculator` repository (as of commit b141415)

## What is in the repo today

| Area | What it is | State | Keep? |
|---|---|---|---|
| `frontend/` | Vue 3 + Vite + TypeScript scaffold (`npm create vue`) with PrimeVue 4 (Aura theme), Pinia, vue-router, Font Awesome | Default "TheWelcome" template still present. Only custom code is `NavBar.vue` (a PrimeVue Menubar with placeholder items: Home, Cargo Calculator, Mining Loadout, tbd) and an `App.vue` that renders only the navbar; `HomeView` still renders the Vue welcome template. No API call from the frontend. | **No.** The README says "Svelte frontend", commit `a70968a` says "Replaced svelte with vue"; the stack flip-flopped and nothing product-specific exists. |
| `backend/` | Symfony 7.1 skeleton (framework-bundle, doctrine ORM + migrations, nelmio CORS, http-client, apache-pack) on `php:8.3-apache` | One controller, `ApiController.php`, with `/api/ships` returning **hard-coded test data** (Aurora MR, Constellation Andromeda), `/api/ships/test` and `/api/hello`. A commented-out call to `https://api.star-citizen.wiki/v2/ships` with a bearer token is the only hint of the intended data source. No entities, no migrations, no tests. | **No.** Nothing beyond a scaffold. The intended data sources are public, read-only and cacheable, so a PHP backend is not needed for v1 (see plan). |
| `vendor/` (1,202 files) and root `composer.json` / `composer.lock` | A stray Composer install at the repo root (nelmio/cors-bundle + Symfony http-kernel etc.) **committed to git** | Should never have been tracked; duplicates `backend/vendor`. Bloats the repo (pack is 8.4 MiB). | **No.** Delete and gitignore. |
| `nginx/html-dev/` (11 files) | A built Vue bundle committed to git | Build artefact. `nginx/html/` is ignored but `html-dev/` is not. | **No.** |
| `nginx/nginx.conf`, `nginx/Dockerfile` | Two nginx server blocks (`starculator.space` → `html`, `dev.starculator.space` → `html-dev`) with `/api/` proxied to the Symfony container; the Dockerfile references `./webserver/nginx.prod.conf` and `/app/build` which do not exist | Partly broken (Dockerfile paths), and the two server blocks both `listen 80` and are selected by `server_name` only. | **Concept only.** The hostname layout (prod / dev / code / backend subdomains) is worth keeping as a deployment idea. |
| `docker-compose.yml` | nginx, cloudflared (Cloudflare Tunnel), code-server, postgres, Symfony backend (dev Dockerfile) | Works as a home-server setup. `backend-prod` / `Dockerfile_prod` referenced in the README do not exist. `code-server` mounts `../` (the parent of the repo). | **Concept only.** Cloudflare Tunnel + a home server is a valid hosting path; the plan compares it with Cloudflare Pages. |
| `config.yml` | Cloudflare Tunnel ingress mapping hostnames to `192.168.1.23:808x` | Contains a private LAN IP; harmless but not something to publish. | **No** (replace with an `.example`). |
| `build.sh` | Builds the Vue app and `sudo cp`'s it into `nginx/html(-dev)` then restarts containers | Works only on the home server; uses `sudo chown`. | **No.** Replace with CI or the SvelteKit adapter's build output. |
| `README.md` | Detailed Docker/Tunnel operations manual | Describes services and files that do not exist (`Dockerfile_prod`, `frontend/starculator-frontend/Dockerfile_dev`, "Svelte frontend"). | **Rewrite.** |
| root `package.json` / `package-lock.json` | Vue/PrimeVue deps duplicated at the repo root | Stray. | **No.** |

## Conclusions

1. There is **no product code** worth migrating: no ship data model, no cargo logic, no API integration, no UI beyond a placeholder navbar. Deleting everything and starting a fresh SvelteKit project costs nothing.
2. What *is* worth carrying over is **intent**: the navbar already names the first two tools (Cargo Calculator, Mining Loadout), the backend already pointed at `api.star-citizen.wiki`, and the infra already assumes `starculator.space` with `dev.` and `backend.` subdomains behind a Cloudflare Tunnel.
3. **Repo hygiene** to fix in the reset: untrack `vendor/` and `nginx/html-dev/`, remove stray root `composer.*` / `package*.json`, keep a `.env.example` and `config.example.yml` instead of real values, and add a proper `.gitignore` for the new stack.
4. **Branch state:** `claude/hopeful-babbage-7scho3` is identical to `origin/main`; the reset can happen on this branch and be reviewed as one PR.
