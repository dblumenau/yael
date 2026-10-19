#!/usr/bin/env bash
# Tag-triggered Cloudflare deploy for yaelmusictherapy (v* tags, via deploy-run).
set -euo pipefail
export PATH="/home/david/bin:/home/david/.local/bin:/home/david/.local/node/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
REPO_DIR=/home/david/yaelmusictherapy
RUN_DIR=/home/david/yaelmusictherapy-run
SITE=https://yaelmusictherapy.danishdave.com
mkdir -p "$RUN_DIR/releases" "$REPO_DIR/deploy-logs"
exec 9>"$RUN_DIR/deploy.lock"
# Exit 75 marks a duplicate trigger skipped in deploy-run; any other failure notifies.
flock -n 9 || { echo 'A deployment is already running; skipping'; exit 75; }
notify_failure() {
  local rc=$?
  [ "$rc" -eq 0 ] || [ "$rc" -eq 75 ] || NOTIFICATION_DELIVERY_INTENT=failure \
    /home/david/bin/notify-watch -h "Deploy failed (exit $rc); see deploy-logs/" "Yael Music Therapy deploy failed" 2>/dev/null || true
}
trap notify_failure EXIT
exec > >(tee -a "$REPO_DIR/deploy-logs/deploy-$(date +%Y%m%d-%H%M%S).log") 2>&1
cd "$REPO_DIR"
git fetch origin --tags --force
TAG="${1:-$(git tag -l 'v[0-9]*' --sort=-version:refname | head -1)}"
TAG="${TAG#refs/tags/}"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Expected stable version tag'; exit 1; }
COMMIT=$(git rev-parse "${TAG}^{commit}")
RELEASE_DIR=$(mktemp -d "$RUN_DIR/releases/${TAG}-XXXXXX")
git archive "$COMMIT" | tar -x -C "$RELEASE_DIR"
[[ -f "$RELEASE_DIR/wrangler.jsonc" ]] || { echo 'Tag has no wrangler.jsonc; refusing deployment'; exit 1; }
set -a
source /home/david/.config/yaelmusictherapy-cloudflare/deploy.env
set +a
cd "$RELEASE_DIR"
bun install --frozen-lockfile
bun run deploy:cloudflare
# A first deploy to a new custom domain waits on certificate issuance, so retry connection errors too.
curl -fsS --retry 12 --retry-delay 5 --retry-all-errors --max-time 20 "$SITE/api/health" | python3 -c 'import json,sys; assert json.load(sys.stdin)["ok"]'
# Capture the page first: `grep -q` exits at the first match and would kill curl with exit 23 under pipefail.
PAGE=$(curl -fsS --retry 3 --retry-all-errors --max-time 20 "$SITE/")
grep -q 'Yael Music Therapy' <<<"$PAGE"
ln -sfn "$RELEASE_DIR" "$RUN_DIR/current.tmp"
mv -Tf "$RUN_DIR/current.tmp" "$RUN_DIR/current"
ls -dt "$RUN_DIR"/releases/*/ | tail -n +4 | xargs -r rm -rf
echo "Deployment complete: $TAG ($COMMIT)"
/home/david/bin/notify-watch -n "Yael Music Therapy $TAG deployed in ${SECONDS}s" "Yael Deploy OK" 2>/dev/null || true
