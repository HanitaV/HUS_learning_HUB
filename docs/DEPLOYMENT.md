# Deployment Guide

**HUS Learning Hub** is a 100% static frontend application. It requires **no backend server, no database, no API keys, and no runtime environment variables**.

Because Vite is configured with `base: './'` (`vite.config.ts`) and React Router uses `HashRouter` (`src/app/App.tsx`), the exact same `dist/` build artifact deploys cleanly to:
- A root domain (`https://example.com/`)
- A repository subpath (`https://username.github.io/HUS_learning_HUB/`)
- Any static CDN or object storage bucket

---

## Prerequisites

Build locally to verify everything passes before deploying:

```sh
npm ci
npm run build
```

This runs `tsc --noEmit`, `vitest run`, and `vite build`, producing the portable static output in `dist/`.

---

## Option 1: Deploy to Vercel

The repository includes [`vercel.json`](../vercel.json), [`.vercelignore`](../.vercelignore), and a manual GitHub Actions workflow ([`.github/workflows/deploy-vercel.yml`](../.github/workflows/deploy-vercel.yml)).

### 1A. Deploy via Vercel CLI

```sh
npx vercel link        # Link to your Vercel project (one-time)
npx vercel             # Preview deployment
npx vercel --prod      # Production deployment
```

`.vercelignore` ensures `docs/`, local caches, and test artifacts are excluded from uploads, and `.vercel/` is gitignored.

### 1B. Deploy via GitHub Actions (Manual Trigger)

Automatic push deployments are disabled by default (`"git": { "deploymentEnabled": false }` in `vercel.json`) so you control when production updates go live.

1. In your GitHub repository, open **Settings → Secrets and variables → Actions** and add:
   - `VERCEL_TOKEN` — create at Vercel **Account Settings → Tokens**
   - `VERCEL_ORG_ID` — from `.vercel/project.json` after `npx vercel link`
   - `VERCEL_PROJECT_ID` — from `.vercel/project.json` after `npx vercel link`
2. Open **Actions → Deploy to Vercel → Run workflow**, choose `preview` or `production`, and run.

### 1C. Enable Automatic Deployments on Git Push (Optional)

If you want Vercel to deploy automatically on every push to your default branch, remove `"git": { "deploymentEnabled": false }` from `vercel.json` and connect the repository in the Vercel Dashboard.

---

## Option 2: Deploy to GitHub Pages

The repository includes [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) for GitHub Pages deployment.

1. In your GitHub repository, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages → Run workflow** to publish `dist/`.
   - To deploy automatically on every push to `main` (or `template`), uncomment the `push:` trigger in `.github/workflows/deploy-pages.yml`.

Because `base: './'` and `HashRouter` are used, you do **not** need to hardcode your repository name in `vite.config.ts`.

---

## Option 3: Cloudflare Pages / Netlify / Any Static Host

Configure your static hosting provider with:

| Setting | Value |
| --- | --- |
| **Node version** | `22.12+` (or `24`) |
| **Install command** | `npm ci` |
| **Build command** | `npm run build` |
| **Output directory** | `dist` |
| **SPA fallback rewrite** | Not required (routes use `#/...`), optional fallback to `index.html` |

Suggested HTTP headers (already configured for Vercel in `vercel.json`):
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- `/*`: `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`

---

## Optional: Configuring WebMCP Origin Trial

The written-essay workspace integrates with **WebMCP (`document.modelContext`)** for two-way structured coaching with Gemini in Chrome.

- **Without an Origin Trial token**: Users can still use WebMCP locally or in production by enabling `chrome://flags/#enable-webmcp-testing` → **Enabled** → **Relaunch**, OR use the built-in 1-click **Copy Prompt + Import JSON** fallback that works in every browser.
- **With an Origin Trial token** (automatic activation on Chrome up to milestone 162):
  1. Register your production origin (e.g., `https://your-site.vercel.app`) at the Chrome Origin Trials portal for the **WebMCP** feature.
  2. Paste the `<meta http-equiv="origin-trial" content="YOUR_TOKEN" />` tag inside `<head>` in [`index.html`](../index.html).
  3. Update `WEBMCP_ORIGIN_TRIAL_INFO.origin` and `WEBMCP_ORIGIN_TRIAL_INFO.hostname` in [`src/infrastructure/ai/webmcp-essay-bridge.ts`](../src/infrastructure/ai/webmcp-essay-bridge.ts) to match your domain so the diagnostic UI reports Origin Trial status accurately.
