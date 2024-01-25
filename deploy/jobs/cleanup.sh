#!/bin/bash

psql --no-password --echo-queries -d "ott_prod" "$DATABASE_URL" -f "cleanup.sql"
