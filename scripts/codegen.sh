#!/bin/bash

set -xeo pipefail

cd "$(dirname "$0")/.." || exit 1

typeshare --lang=typescript --output-file="server/generated.ts" "crates/*"
