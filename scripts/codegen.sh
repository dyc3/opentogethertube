#!/bin/bash

set -xeo pipefail

cd "$(dirname "$0")/.." || exit 1

typeshare "crates/" --lang=typescript --output-file="server/generated.ts"
yarn run lint
