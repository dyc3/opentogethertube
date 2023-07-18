#!/bin/bash

set -exo pipefail

APIKEY=$(heroku config:get OPENTOGETHERTUBE_API_KEY -a ott-staging)
HOST="https://staging.opentogethertube.com"

curl -L -X GET -H "apikey: $APIKEY" $HOST/api/room/list | jq -r .[].name | xargs -I{} curl -L -X DELETE -H "apikey: $APIKEY" $HOST/api/room/{}