#!/bin/bash

HEROKU_SOURCE=opentogethertube
FLY_DEST=ott-redis-prod

# HEROKU_SOURCE=ott-staging
# FLY_DEST=ott-redis

FLY_REDIS_PASSWORD=$(read -r -p "Enter fly redis password: " -s; echo "$REPLY")

echo before we begin, in another terminal, run "fly redis connect $FLY_DEST"
read -r -p "Press enter to continue"

set -exo pipefail

echo download everything from heroku

rm -f redis-keys.txt redis-values.txt dump.rdb
SOURCE_URL=$(heroku config:get REDIS_URL -a $HEROKU_SOURCE)
redis-cli -u "$SOURCE_URL" --scan --pattern "*" > redis-keys.txt
xargs -I {} redis-cli -u "$SOURCE_URL" get {} < redis-keys.txt > redis-values.txt
paste redis-keys.txt redis-values.txt | while read -r a b; do echo -e "SET $a $b"; done > dump.rdb


echo upload everything to fly
# this abuses the fact that fly opens a local port 16379 to the remote redis instance
redis-cli -h 127.0.0.1 -p 16379 --user default --pass "$FLY_REDIS_PASSWORD" --pipe < dump.rdb
