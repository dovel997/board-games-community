# Backend deployment — VPS (Docker + nginx) via GitHub Actions

This guide prepares the VPS and GitHub so that every merge to `main` that changes `backend/**` automatically:

1. runs the backend tests,
2. builds a Docker image and pushes it to **GitHub Container Registry (GHCR)**,
3. connects to the VPS over SSH, pulls the image and restarts the container,
4. checks `/api/health` and fails the run if the new version isn't healthy.

```
Internet ──► Cloudflare proxy ──► VPS :443  nginx ──► 127.0.0.1:5000 ──► Docker container (ASP.NET Core API :8080)
                                         (ufw: 22, 80/443)              (not reachable from outside)
```

**Files in the repo**

| File | Purpose |
|------|---------|
| [`backend/Dockerfile`](../backend/Dockerfile) | Builds the API image (.NET 10) |
| [`backend/deploy/docker-compose.yml`](../backend/deploy/docker-compose.yml) | How the container runs on the VPS (copied there on every deploy) |
| [`backend/deploy/deploy.sh`](../backend/deploy/deploy.sh) | Pull + restart + health check (runs on the VPS, copied on every deploy) |
| [`backend/deploy/nginx/api-http.conf`](../backend/deploy/nginx/api-http.conf) | Temporary nginx config to test over plain HTTP |
| [`backend/deploy/nginx/api.conf`](../backend/deploy/nginx/api.conf) | Production nginx config (HTTPS via Cloudflare) |
| [`backend/deploy/scripts/cloudflare-ips.sh`](../backend/deploy/scripts/cloudflare-ips.sh) | Real visitor IPs in nginx + ufw open only to Cloudflare |
| [`.github/workflows/backend-deploy.yml`](../.github/workflows/backend-deploy.yml) | The GitHub Actions pipeline |

**Assumptions:** Ubuntu 22.04/24.04 (Debian works the same, except the Docker repo URL in Step 3), you can log in to the VPS with a user that has `sudo`, and ufw is installed.

Commands marked **VPS** run in an SSH session on the server. Commands marked **PC** run in PowerShell on your computer, from the repository folder.

> **`VPS_IP` is a placeholder.** Wherever you see `VPS_IP`, type your server's real IP address instead (the one you use for `ssh administrator@...`, also shown in your hosting provider's panel). Example: `ssh-keyscan -t ed25519 VPS_IP` becomes `ssh-keyscan -t ed25519 203.0.113.10`. The IP is saved only once, in the GitHub secret `VPS_HOST` (Step 10).

---

## Part 1 — Prepare the VPS

### Step 1. Update the system

**VPS**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ca-certificates
```

### Step 2. Firewall: keep SSH open first

> ⚠️ Do this **before** enabling ufw or changing rules, or you can lock yourself out.

**VPS**
```bash
sudo ufw status verbose
```

Allow SSH (port 22), then open HTTP/HTTPS for the first test (narrowed to Cloudflare-only in Step 16):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Port 5000 (the API) is **not** opened — only nginx on the server can reach it.

> Docker writes its own iptables rules, and a port published like `"5000:8080"` would be reachable from the internet **even if ufw blocks it**. That's why the compose file publishes `127.0.0.1:5000:8080` (localhost only). Keep it that way.

### Step 3. Install Docker

Official Docker packages (includes the `docker compose` plugin).

**VPS**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

(On Debian, replace both `linux/ubuntu` with `linux/debian`.)

Check:
```bash
sudo docker run --rm hello-world
docker compose version
```

### Step 4. Install nginx

**VPS**
```bash
sudo apt install -y nginx
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl enable --now nginx
```

### Step 5. Let `administrator` run Docker and create the app folder

GitHub Actions logs in as your existing `administrator` user. Run these while logged in as `administrator`:

**VPS**
```bash
sudo usermod -aG docker administrator
sudo mkdir -p /opt/board-games
sudo chown administrator:administrator /opt/board-games
```

Log out and back in (group changes apply to new sessions), then check — it must work **without** `sudo`:

**VPS**
```bash
docker ps
```

> GitHub Actions will be able to log in as a user with sudo rights (and the `docker` group alone is already equivalent to root). Protect the SSH key from Step 6 like a root password, and keep it only in GitHub secrets.

### Step 6. SSH key for GitHub Actions

GitHub Actions needs a private key it can log in with. You can reuse the key you already have, or create a separate one.

#### Option A — use your existing key

Only works if **all** of these are true:

- The key has **no passphrase** (GitHub Actions can't type one). Check: `ssh-keygen -y -f "$HOME\.ssh\id_ed25519"` — if it asks for a passphrase, use Option B.
- You already log in to the VPS as `administrator` with it (so its public key is already in `~/.ssh/authorized_keys`).
- It's the OpenSSH format (file starts with `-----BEGIN OPENSSH PRIVATE KEY-----`). A PuTTY `.ppk` file won't work.

Then skip the rest of this step. In Step 10, use your existing private key file (e.g. `$HOME\.ssh\id_ed25519` or `id_rsa`) wherever the guide says `board-games-deploy`.

> Trade-off: your personal key will then also be stored in GitHub. If you use the same key for other servers or services, anyone who gets it from GitHub can reach those too, and you can't revoke GitHub's access without replacing your own key everywhere. A separate key (Option B) can be revoked on its own by deleting one line on the VPS.

#### Option B — create a separate key (recommended)

A dedicated key used only by GitHub Actions.

**PC**
```powershell
ssh-keygen -t ed25519 -C "github-actions-board-games" -f "$HOME\.ssh\board-games-deploy" -N '""'
```

This creates two files:
- `board-games-deploy` — the **private** key → goes into a GitHub secret (Step 10). Never share or commit it.
- `board-games-deploy.pub` — the **public** key → goes onto the VPS.

Show the public key and copy it:

**PC**
```powershell
Get-Content "$HOME\.ssh\board-games-deploy.pub"
```

Add it to `administrator`'s authorized keys (paste the key in place of `PASTE_PUBLIC_KEY_HERE`). This **appends** with `>>`, so your existing keys keep working:

**VPS** (logged in as `administrator`)
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo 'PASTE_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

> Use `>>` (append), not `>` — a single `>` would replace the file and remove the key you log in with today.

Test the login from your PC (replace `VPS_IP` with your server's IP address):

**PC**
```powershell
ssh -i "$HOME\.ssh\board-games-deploy" administrator@VPS_IP "docker ps"
```

It should log in without a password and print an empty container list.

### Step 7. Get the server's "fingerprint" for GitHub

**Why:** every SSH server has its own identity key. When you first connected to your VPS from your PC, SSH asked *"Are you sure you want to continue connecting?"* — you said yes, and your PC remembered the server. GitHub's machine has never seen your server, and it can't answer that question. So we give it the server's identity in advance (the `VPS_SSH_KNOWN_HOSTS` secret). Then GitHub connects only if the server is really yours, and refuses if someone else pretends to be it.

You only need to do this once. The result is **one line of text** that you paste into GitHub in Step 10. It looks like this:

```
203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGx7...long text...Qz
```

That's: **your server's IP**, a space, `ssh-ed25519`, a space, and a long text starting with `AAAA` (the server's public identity key — not secret).

Use **Option 1** (easiest, works for everyone). Option 2 is an alternative from your PC.

> ⚠️ Don't use the `ssh-keyscan` that comes with Windows. Its version (OpenSSH for Windows 9.5) has a bug and fails with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`. Your server is fine — it's only that Windows tool.

#### Option 1 — read it on the server (recommended)

Reading the key directly on the server is also the safest way: you know it's really your server, so no extra check is needed.

**7a.** Log in to the server from PowerShell:

**PC**
```powershell
ssh administrator@VPS_IP
```

**7b.** On the server, run this — replace `VPS_IP` with the **same IP** you'll put into the `VPS_HOST` secret (the one you just used for `ssh`):

**VPS**
```bash
echo "VPS_IP $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

Example:
```bash
echo "203.0.113.10 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

It prints exactly the line you need:
```
203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGx7...Qz
```

(What it does: `/etc/ssh/ssh_host_ed25519_key.pub` is the server's public identity key. `cut` takes its first two parts — the type and the key — and `echo` puts your IP in front.)

**7c.** Select the printed line, copy it, and paste it into Notepad on your PC for Step 10. Check it's **one single line** starting with your IP. Then `exit` to log out.

#### Option 2 — scan it from your PC (using Git's ssh-keyscan)

Git for Windows includes a working `ssh-keyscan`. In PowerShell:

**PC**
```powershell
& "C:\Program Files\Git\usr\bin\ssh-keyscan.exe" -t ed25519 VPS_IP 2>$null
```

It prints the line you need (plus maybe a line starting with `#` — ignore that one):
```
# 203.0.113.10:22 SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.20
203.0.113.10 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGx7...Qz
```

Copy the line that starts with your IP into Notepad.

With this option, it's worth checking that the key really came from your server (and not from someone in between). Compare the fingerprints — short codes made from the key:

**PC**
```powershell
& "C:\Program Files\Git\usr\bin\ssh-keyscan.exe" -t ed25519 VPS_IP 2>$null | ssh-keygen -lf -
```

**VPS**
```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Both print something like `256 SHA256:Xk3v...9sE ... (ED25519)`. The `SHA256:...` part must be **exactly the same**.

#### Problems in Step 7

| What you see | What it means / what to do |
|--------------|----------------------------|
| `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com` | You used Windows' built-in `ssh-keyscan` (buggy). Use Option 1, or Option 2 with Git's `ssh-keyscan.exe`. |
| Option 1: `cut: /etc/ssh/ssh_host_ed25519_key.pub: No such file or directory` | The server has no ed25519 key. Run `ls /etc/ssh/*.pub`, and use the same command with `ssh_host_ecdsa_key.pub` instead. |
| Option 2: `C:\Program Files\Git\...` not found | Git for Windows is installed elsewhere or not at all — use Option 1. |
| Option 2: waits and prints nothing | Wrong IP, or port 22 blocked. Check that `ssh administrator@VPS_IP` works. |

### Step 8. Connect nginx to the API (test setup over HTTP)

**Why:** the API container will listen only *inside* the server (on `127.0.0.1:5000`), so it can't be reached from the internet directly. nginx is the "front door": it listens on port 80 and passes requests for `/api/...` to the container. For now we use a simple HTTP-only version, so you can test the first deploy by opening `http://VPS_IP/api/health` — before you have a domain or HTTPS. (Step 16 replaces it with the HTTPS version.)

```
Browser ──► http://VPS_IP/api/health ──► nginx (port 80) ──► 127.0.0.1:5000 ──► API container
```

The nginx config file already exists in the repo: [`backend/deploy/nginx/api-http.conf`](../backend/deploy/nginx/api-http.conf). In this step you copy it to the server and switch it on.

**Before you start:** Step 2 (port 80 open in ufw) and Step 4 (nginx installed) must be done.

#### 8a. Open PowerShell in the repository folder

The copy command uses a path inside the repo, so PowerShell must be in the repo folder.

**PC**
```powershell
cd C:\Private\board-games-community
```

Check that the file is there:

**PC**
```powershell
Test-Path backend\deploy\nginx\api-http.conf
```

It must print `True`. If it prints `False`, you're in the wrong folder, or your local copy doesn't have the backend files yet (`git pull` / switch to the branch that has them).

#### 8b. Copy the file to the server

**PC** (replace `VPS_IP`)
```powershell
scp backend/deploy/nginx/api-http.conf administrator@VPS_IP:/tmp/
```

- `scp` = "secure copy": it copies a file over SSH, using the same login as `ssh`.
- `administrator@VPS_IP:/tmp/` = log in as `administrator` and put the file in the server's `/tmp` folder (a temporary folder everyone can write to).
- If your SSH key has a passphrase or you use a password, it asks for it — same as when you `ssh` in.

When it works, it prints one line like:

```
api-http.conf                         100%  712    25.3KB/s   00:00
```

> **No scp?** Alternative: log in with `ssh administrator@VPS_IP`, run `nano /tmp/api-http.conf`, paste the content of `backend/deploy/nginx/api-http.conf` (open it in VS Code / Notepad, **Ctrl + A**, **Ctrl + C**), then save with **Ctrl + O**, **Enter**, **Ctrl + X**. Continue with 8c.

#### 8c. Log in to the server

**PC**
```powershell
ssh administrator@VPS_IP
```

Your prompt changes to something like `administrator@server:~$`. Everything in 8d runs here, on the server.

Check that the file arrived:

**VPS**
```bash
ls -l /tmp/api-http.conf
```

It should list the file. If it says `No such file or directory`, repeat 8b.

#### 8d. Install and enable the config

Run these four commands one by one. `sudo` may ask for `administrator`'s password the first time.

**VPS**
```bash
sudo mv /tmp/api-http.conf /etc/nginx/sites-available/board-games-api
```
Moves the file into `sites-available` — the folder where nginx keeps site configs — and names it `board-games-api`. Prints nothing when it works.

**VPS**
```bash
sudo ln -sf /etc/nginx/sites-available/board-games-api /etc/nginx/sites-enabled/board-games-api
```
nginx only uses configs that are linked in `sites-enabled`. This creates that link (a shortcut). Prints nothing when it works.

Check that the default nginx site is gone (Step 4 removed it) and only yours is enabled:

**VPS**
```bash
ls /etc/nginx/sites-enabled/
```
It must show only `board-games-api`. If `default` is also listed, remove it: `sudo rm /etc/nginx/sites-enabled/default`.

**VPS**
```bash
sudo nginx -t
```
Tests the configuration **without** applying it. It must print exactly these two lines:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If it shows an error instead, **don't continue** — see the table below.

**VPS**
```bash
sudo systemctl reload nginx
```
Applies the new config without stopping nginx. Prints nothing when it works.

#### 8e. Check that nginx answers

From your **PC**, open this address in your browser (with your IP):

```
http://VPS_IP/api/health
```

Or in PowerShell:

**PC**
```powershell
curl.exe -i http://VPS_IP/api/health
```

**Expected right now: `502 Bad Gateway`.** That's correct and means:
- ✅ port 80 is open in the firewall,
- ✅ nginx received your request and used your config,
- ⏳ the API container doesn't exist yet, so nginx has nobody to pass the request to.

After the first deploy (Step 12) the same address returns `{"status":"Healthy",...}`.

Also check `http://VPS_IP/` (without `/api/health`) — it should return **404 Not Found**. That's intended: this server only serves `/api/...`.

You can now log out of the server with `exit`.

#### Problems in Step 8

| What you see | What it means / what to do |
|--------------|----------------------------|
| `scp: ... Permission denied (publickey)` | Same login problem as `ssh`. Check `ssh administrator@VPS_IP` works first. |
| `scp: stat local "backend/deploy/...": No such file or directory` | PowerShell isn't in the repo folder — redo 8a. |
| `nginx -t`: `a duplicate default server for 0.0.0.0:80` | The default site is still enabled: `sudo rm /etc/nginx/sites-enabled/default`, then `sudo nginx -t` again. |
| `nginx -t`: `sudo: nginx: command not found` | nginx isn't installed — do Step 4. |
| Browser: **can't connect / timed out** | Port 80 is blocked: `sudo ufw allow 80/tcp` (Step 2). Or nginx isn't running: `sudo systemctl status nginx`. |
| Browser: **Welcome to nginx!** page | The default site is still active — remove it (first row above), then `sudo systemctl reload nginx`. |
| Browser: **404 Not Found** on `/api/health` | The config isn't enabled. Check `ls /etc/nginx/sites-enabled/` shows `board-games-api`, then reload nginx. |
| Browser: **502 Bad Gateway** | ✅ Expected until the first deploy. |

---

## Part 2 — GitHub setup

### Step 9. Create the `production` environment

1. GitHub repo → **Settings** → **Environments** → **New environment**.
2. Name: `production` → **Configure environment**.
3. (Optional) **Deployment branches and tags** → **Selected branches and tags** → add `main`, so only `main` can deploy.
4. (Optional) **Required reviewers** → add yourself if you want to approve each backend deploy manually.

### Step 10. Add the environment secrets

On the `production` environment page → **Environment secrets** → **Add environment secret**, add:

| Name | Value |
|------|-------|
| `VPS_HOST` | VPS IP address (or hostname that is **not** proxied by Cloudflare) |
| `VPS_USER` | `administrator` |
| `VPS_SSH_KEY` | Full content of the **private** key file (`board-games-deploy`, or your existing key with Option A), including the `-----BEGIN ...-----` and `-----END ...-----` lines |
| `VPS_SSH_KNOWN_HOSTS` | The line from Step 7 |

(There's also an optional `VPS_SSH_PORT` secret — not needed, since your SSH uses the default port 22.)

To copy the private key (Option B key shown — for Option A use your key's file name, e.g. `id_ed25519`):

**PC**
```powershell
Get-Content "$HOME\.ssh\board-games-deploy" -Raw | Set-Clipboard
```

> Use the VPS IP for `VPS_HOST`, not `api.example.com` — once the API domain is proxied by Cloudflare, SSH can't go through it.

### Step 11. Check Actions permissions

1. **Settings** → **Actions** → **General**.
2. **Actions permissions**: allow actions (at least GitHub-owned, `docker/*` actions).
3. **Workflow permissions** can stay **Read repository contents** — the workflow requests `packages: write` itself.

The Docker image is pushed to `ghcr.io/<owner>/board-games-community-api`. You don't need to create anything — the first run creates the package. The VPS logs in with the workflow's short-lived token, so the package can stay **private**.

---

## Part 3 — First deploy

### Step 12. Run the pipeline

1. Merge the PR that adds the backend into `main` (or, if it's already merged: **Actions** → **Backend — test, build image & deploy to VPS** → **Run workflow**).
2. **Actions** tab → open the run. Three jobs run in order: **test** → **build-image** → **deploy**.
3. The **deploy** job prints the health response, e.g.:
   ```json
   {"status":"Healthy","version":"<git sha>","environment":"Production","time":"..."}
   ```

### Step 13. Check from outside

Open `http://VPS_IP/api/health` in your browser — you should see the same JSON. The `version` matches the commit SHA of the deploy.

On the VPS you can also check:

**VPS**
```bash
cd /opt/board-games
docker compose ps
docker compose logs --tail 50 api
```

---

## Part 4 — Domain and HTTPS (Cloudflare)

Do this once your domain is on Cloudflare (see [cloudflare-deployment.md](cloudflare-deployment.md), "Your own domain").

### Step 14. DNS record and SSL mode

In the Cloudflare dashboard, open your domain:

1. **DNS** → **Records** → **Add record**: Type `A`, Name `api`, IPv4 address = VPS IP, Proxy status **Proxied** (orange cloud) → **Save**.
2. **SSL/TLS** → **Overview** → set the encryption mode to **Full (strict)**.

### Step 15. Origin certificate on the VPS

A free certificate from Cloudflare that is trusted by Cloudflare's proxy (valid up to 15 years).

1. Cloudflare → your domain → **SSL/TLS** → **Origin Server** → **Create Certificate**.
2. Keep **Generate private key and CSR with Cloudflare**, key type **RSA** or **ECC**.
3. Hostnames: `api.example.com` (your API hostname).
4. **Create**. Leave the page open — the private key is shown only once.

**VPS**
```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/api.pem   # paste "Origin Certificate", save (Ctrl+O, Enter, Ctrl+X)
sudo nano /etc/ssl/cloudflare/api.key   # paste "Private Key", save
sudo chmod 600 /etc/ssl/cloudflare/api.key
```

### Step 16. Switch nginx to HTTPS

**PC** (from the repository folder)
```powershell
scp backend/deploy/nginx/api.conf backend/deploy/scripts/cloudflare-ips.sh administrator@VPS_IP:/tmp/
```

**VPS** — replace `api.example.com` with your API hostname:
```bash
sudo sed -i 's/api.example.com/api.YOURDOMAIN.com/g' /tmp/api.conf
sudo mv /tmp/api.conf /etc/nginx/sites-available/board-games-api
sudo nginx -t && sudo systemctl reload nginx
```

Then allow web traffic **only from Cloudflare** and make nginx log real visitor IPs:

**VPS**
```bash
sudo bash /tmp/cloudflare-ips.sh
```

After this, `http://VPS_IP/...` no longer works from the internet (by design) — only through Cloudflare.

### Step 17. Check

Open `https://api.YOURDOMAIN.com/api/health` — same JSON as before, now over HTTPS.

The frontend will call this URL later (`VITE_API_URL`), and the API will need CORS for the frontend's domain — that's part of the real API work, not this setup.

---

## Part 5 — App configuration and secrets

Settings like database connection strings or the JWT signing key go into `/opt/board-games/api.env` on the VPS (never into the repo). The compose file loads it automatically.

**VPS**
```bash
nano /opt/board-games/api.env
```
```ini
# Example — ASP.NET Core reads nested settings with double underscores
ConnectionStrings__Default=Host=...;Database=...;Username=...;Password=...
Jwt__SigningKey=...
```
```bash
chmod 600 /opt/board-games/api.env
cd /opt/board-games && docker compose up -d
```

---

## Everyday use

| Task | How |
|------|-----|
| Deploy | Merge a PR that changes `backend/**` into `main` |
| Redeploy | **Actions** → **Backend — test, build image & deploy to VPS** → **Run workflow** |
| Roll back | **Actions** → open an older successful run → **Re-run jobs** → **Re-run all jobs** (deploys that run's image again) |
| Status | VPS: `cd /opt/board-games && docker compose ps` |
| Logs | VPS: `cd /opt/board-games && docker compose logs -f api` |
| Restart | VPS: `cd /opt/board-games && docker compose restart api` |
| Which version runs | `https://api.YOURDOMAIN.com/api/health` → `version` |

## Security checklist

- [ ] SSH: key login only. In `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`, then `sudo systemctl restart ssh` (keep your current session open until you've tested a new login).
- [ ] Automatic security updates: `sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`.
- [ ] Optional: `sudo apt install -y fail2ban` to block SSH brute force.
- [ ] Port 5000 is never opened in ufw, and the compose file keeps `127.0.0.1:5000:8080`.
- [ ] Re-run `cloudflare-ips.sh` every few months (Cloudflare's IP ranges rarely change).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **deploy** job: `Host key verification failed` | `VPS_SSH_KNOWN_HOSTS` is wrong or the server was reinstalled — redo Step 7 and update the secret. |
| **deploy** job: `Permission denied (publickey)` | Check `VPS_USER`, that `VPS_SSH_KEY` is the full private key, and the public key in `/home/administrator/.ssh/authorized_keys` (Step 6). |
| **deploy** job: `Connection timed out` | ufw doesn't allow SSH, wrong `VPS_SSH_PORT`, or `VPS_HOST` points to the Cloudflare-proxied domain instead of the IP. |
| `permission denied ... docker.sock` | `administrator` isn't in the `docker` group: `sudo usermod -aG docker administrator`, then log out and in (Step 5). |
| `scp: ... /opt/board-games: Permission denied` | `sudo chown administrator:administrator /opt/board-games` (Step 5). |
| `Health check failed` | The container started but isn't healthy — the job prints the container logs. Also check `api.env`. |
| Browser shows **502 Bad Gateway** | nginx works but the container isn't running: `docker compose ps` / `logs` on the VPS. |
| Cloudflare error **526** | Origin certificate missing or wrong in nginx, or SSL mode isn't **Full (strict)** with an Origin Certificate. |
| Cloudflare error **521/522** | ufw blocks Cloudflare, or nginx isn't running. Re-run `cloudflare-ips.sh`, `sudo systemctl status nginx`. |
