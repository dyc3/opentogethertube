#!/bin/bash

set -exo pipefail

cd "$(dirname "$0")/.." || exit 1

newVersion="$1"

if [ -z "$newVersion" ]; then
	echo "Usage: $0 <new-version>"
	echo "Example: $0 1.0.0"
	exit 1
fi

find . -type d \( -name node_modules -o -path ./target \) -prune -o -name 'package.json' -print | while read -r package; do
	echo "Setting version to $newVersion in $package"
	jq --arg newVersion "$newVersion" 'if has("version") then .version = $newVersion end' "$package" > /tmp/package.json && mv /tmp/package.json "$package"
done
find . -type d \( -name node_modules -o -path ./target \) -prune -o -name 'Cargo.toml' -print | while read -r cargo; do
	echo "Setting version to $newVersion in $cargo"
	sed -i "s/^version = .*/version = \"$newVersion\"/" "$cargo"
done
