#!/bin/bash

set -xeo pipefail

cd "$(dirname "$0")/.." || exit 1

typeshare "crates/" --lang=typescript --output-file="server/generated.ts"
sed -i 's/M2BRoomMsg<T>/M2BRoomMsg<T = unknown>/g' server/generated.ts
sed -i 's/B2MClientMsg<T>/B2MClientMsg<T = unknown>/g' server/generated.ts
sed -i 's/currentSource: Value/currentSource: unknown/g' server/generated.ts
yarn run lint
