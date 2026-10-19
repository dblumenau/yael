# Deploy runbook

yaelmusictherapy is a static Vite page plus a Cloudflare Worker, served at
`https://yaelmusictherapy.danishdave.com` (also `https://yaelmusictherapy.ecc-notes.workers.dev`).
Workers Static Assets serves `dist/`; the Worker (`worker/index.ts`) handles
`POST /api/contact` and `GET /api/health`, and stores contact submissions in
a SQLite Durable Object (`ContactsDatabase`, binding `CONTACTS`, table
`contacts`, selected by name from the `INSTANCE_NAME` var
`yaelmusictherapy-production`; never change it in a deploy, a different name is
a different, empty database). Nothing runs on Hetzner at request time.

| Piece | Where |
|-------|-------|
| Hetzner build source (fetch-only, stays on `main`) | `/home/david/yaelmusictherapy` |
| Release dirs (`git archive` of each tag) | `/home/david/yaelmusictherapy-run/releases/<tag>-*` |
| Deploy credentials (mode 600, never print) | `/home/david/.config/yaelmusictherapy-cloudflare/deploy.env` |
| Deploy logs | `/home/david/yaelmusictherapy/deploy-logs/deploy-<ts>.log` |
| Webhook hook | `yaelmusictherapy-deploy` → `https://panelforge.danishdave.com/hooks/yaelmusictherapy-deploy` |

## Steady state

```
git tag v0.1.0 && git push origin v0.1.0
  → GitHub push event → Hetzner webhook (:9000) → HMAC + ^refs/tags/v.*$
  → deploy-run yaelmusictherapy scripts/deploy-webhook.sh refs/tags/v0.1.0
```

`scripts/deploy-webhook.sh` archives the tag into a release dir, requires
`wrangler.jsonc`, sources `deploy.env`, and runs `bun run deploy:cloudflare`
(typecheck, vitest, `vite build`, `wrangler deploy`). It then checks `/api/health` and the page title on the
public URL. A concurrent trigger exits 75 (skipped); any other failure fires a
`notify-watch` failure notification.

Verify: `ssh hetzner '/home/david/bin/wait-deploy yaelmusictherapy <tag>'`.

## Contacts

Submissions are only stored; no email is sent. `GET /api/admin/contacts` with
`Authorization: Bearer <ADMIN_TOKEN>` returns the newest 200 as JSON. Without
the right token it answers 404. The token is the Worker secret `ADMIN_TOKEN`
and is kept in `/home/david/.config/yaelmusictherapy-cloudflare/admin.env`:

```
ssh hetzner 'set -a; source ~/.config/yaelmusictherapy-cloudflare/admin.env; set +a; curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://yaelmusictherapy.danishdave.com/api/admin/contacts'
```

## Rollback

Cloudflare keeps Worker versions: `bunx wrangler rollback` (with the deploy
credentials sourced). Keep `INSTANCE_NAME` and the `migrations` tags unchanged.

## Local

```
bun install
echo 'ADMIN_TOKEN=local' > .dev.vars   # gitignored
bun run dev:worker     # builds, then serves Worker + assets on :8787
```

`bun run dev` serves the static page through Vite on :5191 and proxies `/api`
to `:8787`.

## One-time setup

1. Create `deploy.env` with `CLOUDFLARE_API_TOKEN` (Workers Scripts edit and
   Workers Routes/DNS for the zone) and `CLOUDFLARE_ACCOUNT_ID`; the ecc-notes
   token works.
2. After the first deploy creates the Worker, set the secret with
   `wrangler secret put ADMIN_TOKEN` and save it in `admin.env`.
3. Clone the repo to `/home/david/yaelmusictherapy` on Hetzner.
4. Add `deploy/webhook-hook.json` (real HMAC secret) to
   `/home/david/panelforge-prod/webhook-config.json`, then reload hooks:
   `kill -USR1 "$(systemctl show -p MainPID --value panelforge-webhook)"`.
5. Add a GitHub push webhook on the repo pointing at the hook URL, with the
   same secret.
6. The first `wrangler deploy` attaches the custom domain
   `yaelmusictherapy.danishdave.com` and creates its DNS record.
