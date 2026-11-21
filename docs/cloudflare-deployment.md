# Frontend deployment — Cloudflare Pages via GitHub Actions

This guide sets up hosting for the React frontend on **Cloudflare Pages** (free plan) and automatic deploys from **GitHub Actions**.

- Push to `main` touching `frontend/**` → deploys to **production**.
- Pull request touching `frontend/**` → deploys a **preview** with its own URL.
- The backend and database stay on the VPS (see [technical.md](technical.md)).

The workflow is already in the repo: [`.github/workflows/frontend-deploy.yml`](../.github/workflows/frontend-deploy.yml).

> Cloudflare's dashboard changes from time to time. If a button name below doesn't match exactly, look for the closest equivalent — the steps stay the same.

---

## Part 1 — Cloudflare setup

### Step 1. Create a Cloudflare account

1. Go to <https://dash.cloudflare.com/sign-up> and sign up (free plan).
2. Verify your email address.

### Step 2. Create the Pages project

The project must exist before GitHub Actions can deploy to it. We use **Direct Upload**, because GitHub Actions builds the app and uploads the result (Cloudflare does not build it).

**Option A — dashboard**

1. In the dashboard, open **Workers & Pages** → **Create** → **Pages** tab.
2. Choose **Use direct upload** (not "Connect to Git").
3. Project name: `board-games-community`.
   - This must match `CLOUDFLARE_PROJECT_NAME` in the workflow file. If you choose another name, change it there too.
   - The name becomes your default URL: `https://board-games-community.pages.dev` (a suffix is added if the name is taken — use whatever Cloudflare shows).
4. Upload anything to finish creating the project — e.g. run `npm run build` in `frontend/` and drag in the `dist` folder. GitHub Actions will replace it.

**Option B — command line**

```powershell
cd frontend
npx wrangler login
npx wrangler pages project create board-games-community --production-branch main
```

### Step 3. Check the production branch

1. Open **Workers & Pages** → `board-games-community` → **Settings**.
2. Make sure the **production branch** is `main`.

Deployments from `main` go to production; deployments from any other branch name become previews.

### Step 4. Create an API token for GitHub Actions

1. Click your profile icon (top right) → **My Profile** → **API Tokens** → **Create Token**.
2. Choose **Create Custom Token** → **Get started**.
3. Fill in:
   - **Token name:** `github-actions-pages-deploy`
   - **Permissions:** `Account` → `Cloudflare Pages` → `Edit`
   - **Account Resources:** `Include` → your account
   - Leave the other fields empty (optional: set a TTL so the token expires).
4. **Continue to summary** → **Create Token**.
5. **Copy the token now** — Cloudflare shows it only once.

The token can only manage Pages in your account. Never commit it to the repo.

### Step 5. Copy your Account ID

1. Open **Workers & Pages** (or your account home page).
2. Find **Account ID** in the right sidebar and copy it.

---

## Part 2 — GitHub setup

### Step 6. Add the secrets to the repository

1. On GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions**.
2. Under **Repository secrets**, click **New repository secret** and add:

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | the token from Step 4 |
| `CLOUDFLARE_ACCOUNT_ID` | the Account ID from Step 5 |

`GITHUB_TOKEN` is provided automatically — you don't add it.

### Step 7. Check Actions permissions

1. Repository → **Settings** → **Actions** → **General**.
2. **Actions permissions:** allow actions (at least GitHub-owned actions and `cloudflare/wrangler-action`).
3. The workflow sets its own `permissions` (`contents: read`, `deployments: write`), so the default workflow permissions can stay read-only.

### Step 8. (Recommended) Protect `main`

1. Repository → **Settings** → **Branches** (or **Rules** → **Rulesets**) → add a rule for `main`.
2. Require a pull request before merging.
3. Require status checks to pass → select **build-and-deploy**.

This way nothing reaches production without passing lint, tests and the build.

---

## Part 3 — How the workflow works

File: [`.github/workflows/frontend-deploy.yml`](../.github/workflows/frontend-deploy.yml)

| Trigger | What happens |
|---------|--------------|
| Push to `main` changing `frontend/**` | lint → test → build → deploy to **production** |
| Pull request changing `frontend/**` | lint → test → build → deploy a **preview** (branch name as alias) |
| Pull request from a fork | lint → test → build only (forks get no secrets) |
| Manual (**Actions** tab → **Run workflow**) | same as a push on the selected branch |

Steps inside the job:

1. Check out the code.
2. Set up Node 22 with npm cache.
3. `npm ci` — clean install from `package-lock.json`.
4. `npm run lint`, `npm test`, `npm run build` — any failure stops the deploy.
5. `wrangler pages deploy dist --project-name=board-games-community --branch=<branch>` uploads `frontend/dist`.
6. The deployment URL is written to the job summary. With `gitHubToken` set, the deployment also shows up under the repo's **Deployments** section.

### Single-page app routing

Cloudflare Pages serves `index.html` for any path that isn't a file, as long as there is **no `404.html`** in the build. That's what makes React Router URLs like `/games` work on reload. Don't add a `404.html` to `frontend/public`.

### Headers

[`frontend/public/_headers`](../frontend/public/_headers) is copied into the build and sets security headers plus long caching for `/assets/*`. Add a Content-Security-Policy there once the API domain is known.

---

## Part 4 — First deploy

1. Commit and push the workflow and the frontend to a branch, then open a pull request into `main`.
2. Open the PR's **Checks** → **build-and-deploy**. When it's green, the job summary shows the preview URL, e.g. `https://<branch>.board-games-community.pages.dev`.
3. Open the preview URL and click through the pages. Reload on `/games` to check routing.
4. Merge the PR. The workflow runs again on `main` and deploys to production: `https://board-games-community.pages.dev`.
5. In Cloudflare, **Workers & Pages** → `board-games-community` → **Deployments** lists every deploy.

---

## Part 5 — Custom domain (optional)

### Step 1. Move the domain's DNS to Cloudflare

1. Dashboard → **Add a domain** → enter your domain → choose the **Free** plan.
2. Cloudflare scans the existing DNS records — check they're all there (especially mail records).
3. Cloudflare shows two **nameservers**. At your domain registrar, replace the existing nameservers with these.
4. Wait until the domain shows **Active** (minutes to a few hours).

### Step 2. Attach the domain to Pages

1. **Workers & Pages** → `board-games-community` → **Custom domains** → **Set up a custom domain**.
2. Enter `example.com` (and/or `www.example.com`).
3. Cloudflare creates the DNS record and the HTTPS certificate automatically.

### Step 3. Point the API subdomain at the VPS

1. **DNS** → **Records** → **Add record**: type `A`, name `api`, IPv4 = your VPS IP.
2. Proxy status: **Proxied** (orange cloud) hides the VPS IP and adds DDoS protection.
3. **SSL/TLS** → **Overview** → set the mode to **Full (strict)** and install a certificate on the VPS (Cloudflare Origin Certificate or Let's Encrypt).

### Step 4. Connect frontend and API

- The backend must allow CORS from `https://example.com` with credentials.
- The frontend needs the API URL at build time. When the API exists:
  1. GitHub → **Settings** → **Secrets and variables** → **Actions** → **Variables** → add `VITE_API_URL` = `https://api.example.com`.
  2. In the workflow's **Build** step, add `env: VITE_API_URL: ${{ vars.VITE_API_URL }}`.
- Preview URLs (`*.pages.dev`) are a different site from your API, so the refresh-token cookie won't work there. Use previews for checking UI, or set up a staging API later.

---

## Part 6 — Everyday use

| Task | How |
|------|-----|
| Deploy to production | Merge a PR into `main` |
| Preview a change | Open a PR — the URL is in the job summary |
| Redeploy without changes | **Actions** → workflow → **Run workflow** |
| Roll back | Cloudflare → project → **Deployments** → pick an older deployment → **Rollback to this deployment** |
| Deploy manually from your PC | `cd frontend` → `npm run build` → `npx wrangler pages deploy dist --project-name=board-games-community` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Project not found` | Create the project first (Step 2) and check the name matches `CLOUDFLARE_PROJECT_NAME`. |
| `Authentication error` / `10000` | Token is wrong or lacks **Cloudflare Pages: Edit**; check `CLOUDFLARE_ACCOUNT_ID`. |
| Deploy step skipped on a PR | The PR comes from a fork — expected, forks don't get secrets. |
| Workflow didn't run | It only runs when files in `frontend/` or the workflow file change. Use **Run workflow** to force it. |
| Reload on `/games` gives 404 | A `404.html` ended up in `dist` — remove it. |
| Production didn't update | Check the project's production branch is `main` (Step 3). |
