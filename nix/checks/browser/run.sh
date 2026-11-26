#!/usr/bin/env bash

set -euo pipefail

./node_modules/.bin/playwright test --config ./playwright.config.ts "$@"
