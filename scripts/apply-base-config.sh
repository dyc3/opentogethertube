#!/bin/bash

cd $(dirname $0)/.. || exit 1

if [[ $HEROKU == 1 ]]; then
	echo "Applying Heroku base config"
	cp -f env/heroku.base.toml env/base.toml
elif [[ $DOCKER == 1 ]]; then
	echo "Applying Docker base config"
	cp -f env/docker.base.toml env/base.toml
fi
