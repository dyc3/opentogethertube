#!/bin/bash

HEROKU_SOURCE=opentogethertube
FLY_DEST=ott-db-prod
FLY_DEST_DB_NAME=ott_prod

# HEROKU_SOURCE=ott-staging
# FLY_DEST=ott-db-staging
# FLY_DEST_DB_NAME=ott_staging

set -exo pipefail

echo "run the postgres importer"

db_url=$(heroku config:get DATABASE_URL -a $HEROKU_SOURCE)
fly pg import "$db_url" -a "$FLY_DEST" --region ewr

echo "do a little dance to rename the database"

# extract the database name from heroku db url
db_name=$(echo "$db_url" | sed -e 's/^postgres:\/\/[^\/]*\/\(.*\)$/\1/')
echo "database name is $db_name"

echo "run these commands on the fly postgres instance"

cat << EOF
DROP DATABASE $FLY_DEST_DB_NAME WITH (FORCE);
SELECT pg_terminate_backend (pid) FROM pg_stat_activity WHERE datname = '$db_name';
ALTER DATABASE $db_name RENAME TO $FLY_DEST_DB_NAME;
EOF

fly pg connect -a "$FLY_DEST"
