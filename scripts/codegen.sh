#!/bin/bash

set -xeo pipefail

cd "$(dirname "$0")/.." || exit 1

typeshare "crates/" --lang=typescript --output-file="server/generated.ts"
sed -i 's/interface M2BRoomMsg<T>/interface M2BRoomMsg<T = unknown>/g' server/generated.ts
sed -i 's/interface B2MClientMsg<T>/interface B2MClientMsg<T = unknown>/g' server/generated.ts
sed -i 's/currentSource: Value/currentSource: unknown/g' server/generated.ts
sed -i 's/type MsgM2B<T>/type MsgM2B<T = unknown>/g' server/generated.ts
yarn run lint
