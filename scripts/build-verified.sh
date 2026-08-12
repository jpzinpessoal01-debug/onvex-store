#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  # Call through bash so deployments unpacked on Windows/ZIP (where executable
  # bits are not preserved) still initialize the runtime environment correctly.
  exec bash "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

command -v timeout || {
  echo "build-verified.sh requires GNU timeout." >&2
  exit 69
}

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

# Vercel runs the same repository as the Sites preview, but its runtime is
# Next.js on Node rather than the Cloudflare Worker adapter. The Neon schema is
# prepared at deploy time so the first Vercel request never sees a blank DB.
if [[ "${VERCEL:-}" == "1" ]]; then
  node "${SITES_PROJECT_ROOT}/scripts/migrate-neon.mjs"
  next_bin="${SITES_PROJECT_ROOT}/node_modules/.bin/next"
  if [[ ! -x "${next_bin}" ]]; then
    echo "next is unavailable." >&2
    exit 69
  fi
  exec "${next_bin}" build
fi

echo "Running bounded vinext build..."
timeout \
  --signal=TERM \
  --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
  "${SITES_BUILD_TIMEOUT:-3m}" \
  "${vinext}" build

"${script_dir}/validate-artifact.sh"
