#!/bin/bash

set -exo pipefail

APIKEY=$(heroku config:get OPENTOGETHERTUBE_API_KEY -a opentogethertube)
HOST="https://opentogethertube.com"

curl -L -X GET -H "apikey: $APIKEY" $HOST/api/room/list | jq -r .[].name | xargs -I{} curl -L -X DELETE -H "apikey: $APIKEY" $HOST/api/room/{}