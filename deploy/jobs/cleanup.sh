#!/bin/bash

DB_NAME="ott_prod"
# HACK: in order to connect to the right database, we need to replace the database name in the path of the DATABASE_URL, but NOT the username
CONNECTION_URL=$(echo "$DATABASE_URL" | sed --regexp-extended "s/$FLY_APP_NAME(\?|$)/$DB_NAME/g")

psql --no-password --echo-queries "$CONNECTION_URL" -f "cleanup.sql"
