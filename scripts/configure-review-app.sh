#!/bin/bash

# Automatically configure's a given heroku review app
# For maintainers

REVIEW_APP="$1"

# make sure we are in the right directory
cd "$(dirname "$0")/.." || exit 5

function review_get {
	heroku config:get -a "$REVIEW_APP" "$1"
}

function prod_get {
	heroku config:get -a "opentogethertube"
}

echo "Configuring $REVIEW_APP..."
heroku config:set -a "$REVIEW_APP" "OTT_HOSTNAME=$(review_get HEROKU_APP_NAME).herokuapp.com" $(cat env/staging.env)

if [[ $(heroku addons -a "$REVIEW_APP" | grep -v "No add-ons for app" | wc -l) = 0 ]]; then
	echo "Creating addons"
	heroku addons:create -a "$REVIEW_APP" heroku-postgresql
	heroku addons:wait -a "$REVIEW_APP"
	heroku addons:create -a "$REVIEW_APP" heroku-redis
	heroku addons:wait -a "$REVIEW_APP"
fi

heroku run -a "$REVIEW_APP" "sequelize db:migrate --url \$DATABASE_URL"
