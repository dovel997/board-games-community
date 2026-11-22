# Frontend deployment — Cloudflare + GitHub (dashboard guide)

The React frontend is hosted on **Cloudflare Workers** (free plan) and deployed automatically by **GitHub Actions**. Everything in this guide is done by clicking in the Cloudflare and GitHub websites — no commands needed.

**How it works:** you don't create the website in Cloudflare yourself. You give GitHub permission to deploy to your Cloudflare account, and the first time GitHub Actions runs, it creates the Worker **`board-games-community`** and uploads the site. After that, every merge to `main` updates it.

| Event | Result |
|-------|--------|
| Merge / push to `main` changing `frontend/**` | Deploys to **production** |
| Pull request changing `frontend/**` | Checks lint, tests and build; tries a **preview** URL (beta) |
| Pull request closed | The preview is deleted |

> Cloudflare changes its dashboard often. Button names below come from Cloudflare's documentation (November 2026). If a label differs slightly on your screen, pick the closest match.

---

## Part 1 — Cloudflare

### Step 1. Create an account

1. Go to <https://dash.cloudflare.com/sign-up>.
2. Sign up, choose the **Free** plan, and verify your email.

### Step 2. Choose your workers.dev subdomain

Your site's free address will be `board-games-community.<your-subdomain>.workers.dev`. The subdomain is set once per account.

1. In the left sidebar, click **Workers & Pages**.
2. Find **Your subdomain** (on the right side of the page).
3. Click **Change**, type a name (e.g. your username), and save.
   - If Cloudflare asks you to pick a subdomain the first time you open **Workers & Pages**, do it there — same thing.

> **Do not** click **Create application** → **Upload your static files**. That's not needed — GitHub Actions creates the Worker. (If you already created one there, see [Clean-up](#clean-up-optional).)

### Step 3. Create an API token for GitHub

1. Click **Manage Account** in the left sidebar → **API Tokens**.
   (Direct link: <https://dash.cloudflare.com/?to=/:account/api-tokens>)
2. Click **Create Token**.
3. In the list of templates, find **Edit Cloudflare Workers** and click **Use template** next to it.
4. Give the token a name, e.g. `github-actions-frontend`.
5. In the resources section:
   - **Account** → select your account.
   - **Zone** → **All zones** (or only your domain, once you have one).
6. (Optional) Set an expiration date.
7. Click **Continue to summary** → **Create Token**.
8. **Copy the token now** and keep it somewhere safe for Step 5 — Cloudflare shows it only once.

### Step 4. Copy your Account ID

1. Click **Workers & Pages** in the left sidebar.
2. In the **Account Details** section, click the copy button next to **Account ID**.

(Alternative: press **Ctrl + K** anywhere in the dashboard and search for **Copy account ID**.)

---

## Part 2 — GitHub

### Step 5. Add the two secrets

1. Open the repository on github.com.
2. Click **Settings** (top tab) → in the left menu **Secrets and variables** → **Actions**.
3. Click **New repository secret**:
   - **Name:** `CLOUDFLARE_API_TOKEN` · **Secret:** the token from Step 3 → **Add secret**.
4. Click **New repository secret** again:
   - **Name:** `CLOUDFLARE_ACCOUNT_ID` · **Secret:** the Account ID from Step 4 → **Add secret**.

### Step 6. Check that Actions are allowed

1. **Settings** → **Actions** → **General**.
2. Under **Actions permissions**, make sure actions are allowed (**Allow all actions and reusable workflows** is simplest).
3. Click **Save** if you changed anything.

### Step 7. (Recommended) Protect `main`

1. **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. **Ruleset name:** `main`. **Enforcement status:** **Active**.
3. **Target branches** → **Add target** → **Include default branch**.
4. Tick **Require a pull request before merging**.
5. Tick **Require status checks to pass** → **Add checks** → type `build-and-deploy` and select it (it appears after the workflow has run once).
6. Click **Create**.

---

## Part 3 — First deploy

### Step 8. Merge the frontend changes into `main`

1. On GitHub, open the pull request with the frontend/deployment changes (or create one: **Pull requests** → **New pull request**).
2. Wait for the **build-and-deploy** check to turn green. On this first PR, the preview step may show a warning — that's expected, the Worker doesn't exist yet.
3. Click **Merge pull request** → **Confirm merge**.
4. Click the **Actions** tab → open the newest **Frontend — build & deploy to Cloudflare Workers** run → wait for the green check.

### Step 9. Check the site in Cloudflare

1. In Cloudflare, click **Workers & Pages**. You now see **board-games-community** in the list.
2. Click it. The page shows the site address: `https://board-games-community.<your-subdomain>.workers.dev`.
3. Open the address, click through **Home / Games / Sessions / About**, and reload the page on **Games** — it should still load.

From now on, every merge into `main` that changes `frontend/` updates the site automatically.

> **About `board-games-community.pages.dev`:** that address belongs to a Cloudflare *Pages* project. If it isn't in your dashboard, it's someone else's site with the same name. Your site is the `workers.dev` address above (or your own domain, below).

---

## Part 4 — Your own domain

✅ **Done:** the site runs on **https://board-games-community.com**. The domain is in [`frontend/wrangler.jsonc`](../frontend/wrangler.jsonc) (`routes`), so every deploy keeps it attached. The `workers.dev` address keeps working too (PR previews use it).

The steps below are for reference (e.g. adding `www` or redoing the setup).

### Step 10. Add the domain to Cloudflare

Skip this if you bought the domain on Cloudflare — it's already there.

1. In the left sidebar, click **Domains** → **Onboard a domain**.
2. Enter `board-games-community.com`, keep the default DNS option, click **Continue**.
3. Select the **Free** plan.
4. Review the DNS records Cloudflare found. Add any missing ones (especially email records), then **Continue**.
5. Cloudflare shows **two nameservers**. Log in to the company where you bought the domain (your registrar) and replace its nameservers with these two. If DNSSEC is on at the registrar, turn it off first.
6. Back in Cloudflare, wait until the domain shows as **Active** (minutes to a few hours; Cloudflare emails you).

### Step 11. Connect the domain to the site

The domain is attached by the config in the repo, `frontend/wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "board-games-community.com", "custom_domain": true }
]
```

On deploy, Cloudflare creates the DNS record and the HTTPS certificate automatically. The hostname must not already have a CNAME record — delete it under **DNS** → **Records** first if it does.

**To add `www.board-games-community.com`:** add a second line to `routes` — `{ "pattern": "www.board-games-community.com", "custom_domain": true }` — and merge. (Or add it in the dashboard: **Workers & Pages** → **board-games-community** → **Settings** → **Domains & Routes** → **Add** → **Custom Domain** — but then also add it to `wrangler.jsonc`, so config and dashboard match.)

### Step 12. Point the API subdomain at your VPS

Covered in detail in [vps-backend-deployment.md](vps-backend-deployment.md), Part 4 (Steps 14–17): DNS record `api` → VPS IP (proxied), SSL mode **Full (strict)**, Origin Certificate on the VPS.

---

## Everyday use

| Task | Where |
|------|-------|
| Deploy to production | GitHub: merge a PR into `main` |
| See deploy progress / errors | GitHub: **Actions** tab → the latest run |
| Redeploy without changes | GitHub: **Actions** → **Frontend — build & deploy to Cloudflare Workers** → **Run workflow** |
| See all deployments | Cloudflare: **Workers & Pages** → **board-games-community** → **Deployments** |
| Roll back | Cloudflare: **Deployments** → **⋯** next to an older version → **Rollback** |
| Preview a pull request | GitHub: PR → **Checks** → **build-and-deploy** → **Summary** shows the preview URL (beta) |

Note: settings like SPA routing live in the repo (`frontend/wrangler.jsonc`), not in the dashboard. Each deploy re-applies them, so changes made to those settings in the dashboard can be overwritten.

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Deploy fails with `Authentication error` | Recreate the token with the **Edit Cloudflare Workers** template (Step 3) and update `CLOUDFLARE_API_TOKEN` in GitHub (Step 5 — open the secret and click **Update**). Check `CLOUDFLARE_ACCOUNT_ID`. |
| Deploy fails mentioning a **workers.dev subdomain** | Do Step 2. |
| Workflow didn't start | It only runs when files in `frontend/` change. Use **Run workflow** (Actions tab). |
| No **Run workflow** button | The workflow must be on `main` first — merge the PR (Step 8). |
| Preview step shows a warning | Worker previews are in beta and need the Worker to exist. Production deploys aren't affected. |
| Reloading a page like `/games` shows 404 | Tell a developer: `not_found_handling` in `frontend/wrangler.jsonc` must be `single-page-application`. |

## Clean-up (optional)

If you created a Worker earlier with **Create application** → **Upload your static files**:

- Named **board-games-community** → leave it, the first GitHub deploy replaces its content.
- Any other name → **Workers & Pages** → click it → **Settings** → scroll down → **Delete**.
