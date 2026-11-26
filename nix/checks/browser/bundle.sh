#!/usr/bin/env bash

set -euo pipefail

target="$(./node_modules/.bin/tsc --showConfig -p ./tsconfig.build.json |
  jq -er '.compilerOptions.target | strings | ascii_downcase')"
mkdir -p tmp/integration-browser
./node_modules/.bin/esbuild dist/index.js \
  --bundle \
  --platform=browser \
  --format=esm \
  --target="$target" \
  --outfile=tmp/integration-browser/browser.js
