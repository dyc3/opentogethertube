#!/bin/bash

set -euo pipefail

DB_NAME="ott_prod"

# HACK: the app name is used as the username for the database, but it can't contain dashes
DB_USERNAME=${FLY_APP_NAME//-/_}
echo "DB_USERNAME: $DB_USERNAME"
# HACK: in order to connect to the right database, we need to replace the database name in the path of the DATABASE_URL, but NOT the username
CONNECTION_URL=$(echo "$DATABASE_URL" | sed --regexp-extended "s/$DB_USERNAME(\?|$)/$DB_NAME?/g")
echo "CONNECTION_URL: $CONNECTION_URL"

while true; do
	DELETED_ROWS=$(psql --no-password --quiet --tuples-only --no-align "$CONNECTION_URL" -f "cleanup.sql")
	DELETED_ROWS=$(echo "$DELETED_ROWS" | tr -d '[:space:]')
	echo "Deleted rows: $DELETED_ROWS"

	if [[ "$DELETED_ROWS" == "0" ]]; then
		break
	fi
done
