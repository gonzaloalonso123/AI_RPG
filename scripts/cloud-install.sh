#!/usr/bin/env bash
set -euo pipefail
cd /workspace/AI_RPG
mkdir -p /workspace/toolchains
if [[ ! -x /workspace/toolchains/node-v22.23.3-linux-x64/bin/node ]]; then
 python3 - <<'PY'
import urllib.request,hashlib,tarfile
base='https://nodejs.org/dist/v22.23.3/';name='node-v22.23.3-linux-x64.tar.xz'
sums=urllib.request.urlopen(base+'SHASUMS256.txt').read().decode()
expected=next(line.split()[0] for line in sums.splitlines() if line.split()[-1]==name)
data=urllib.request.urlopen(base+name).read()
assert hashlib.sha256(data).hexdigest()==expected, 'Node archive checksum mismatch'
p='/workspace/toolchains/'+name;open(p,'wb').write(data)
with tarfile.open(p) as archive: archive.extractall('/workspace/toolchains',filter='data')
PY
fi
export PATH="/workspace/toolchains/node-v22.23.3-linux-x64/bin:/workspace/toolchains/pnpm/node_modules/.bin:$PATH"
export XDG_DATA_HOME=/workspace/.local/share XDG_CACHE_HOME=/workspace/.cache XDG_CONFIG_HOME=/workspace/.config
export npm_config_cache=/workspace/.npm FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase/emulators PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
if [[ ! -x /workspace/toolchains/pnpm/node_modules/.bin/pnpm ]]; then npm install --prefix /workspace/toolchains/pnpm pnpm@11.19.0 --no-audit --no-fund; fi
cat > /workspace/toolchains/activate.sh <<'ACTIVATE'
export PATH="/workspace/toolchains/node-v22.23.3-linux-x64/bin:/workspace/toolchains/pnpm/node_modules/.bin:$PATH"
export XDG_DATA_HOME=/workspace/.local/share XDG_CACHE_HOME=/workspace/.cache XDG_CONFIG_HOME=/workspace/.config
export npm_config_cache=/workspace/.npm FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase/emulators PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
ACTIVATE
pnpm install --frozen-lockfile
pnpm build
pnpm prepare:functions
node scripts/prepare-emulators.mjs
pnpm exec playwright install chromium
pnpm preflight
pnpm test
