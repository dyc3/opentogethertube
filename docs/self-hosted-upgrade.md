# Self-Hosted Upgrade Guide

This guide is for self-hosted operators upgrading OpenTogetherTube after the switch from Sequelize to Drizzle.

## What Changed

OpenTogetherTube no longer uses Sequelize for database access or migrations.

The old commands based on `sequelize` or `sequelize-cli` have been replaced with:

```bash
yarn db:migrate
```

This new migration runner:

-   supports PostgreSQL and SQLite
-   reads the normal OTT config
-   tracks new migrations in `__drizzle_migrations`
-   can adopt existing databases that were previously managed by Sequelize

## Who Needs To Care

You should follow this guide if you:

-   self-host OTT directly on a VM or bare metal
-   use Docker or docker-compose to run your own OTT deployment
-   upgrade an existing installation that was already using PostgreSQL or SQLite

## Before You Upgrade

1. Back up your database.
2. Back up your `env/*.toml` config files.
3. Make sure you know whether you are using PostgreSQL or SQLite.
4. Stop the app or plan a maintenance window before running migrations.

## Check Your Current Database Backend

OTT reads its DB backend from config.

Common cases:

-   PostgreSQL: `db.mode = "postgres"`
-   SQLite: `db.mode = "sqlite"`

If you are not sure, inspect your active config file in `env/`.

## Upgrade Steps

From the repository root:

```bash
corepack enable
yarn install --immutable
NODE_ENV=production yarn db:migrate
yarn build
NODE_ENV=production yarn start
```

Recommended order:

1. update the code
2. install dependencies
3. run migrations
4. build
5. restart the app

## PostgreSQL Upgrade Notes

If your deployment already used PostgreSQL with the old Sequelize migrations:

-   keep your existing database
-   run `NODE_ENV=production yarn db:migrate`
-   the new runner should detect the old migration history and adopt it

After the first successful run:

-   old Sequelize tooling is no longer needed
-   future migrations are tracked in `__drizzle_migrations`

## SQLite Upgrade Notes

If you are using SQLite:

```bash
NODE_ENV=production DB_MODE=sqlite yarn db:migrate
```

OTT stores SQLite database files under `server/db/`.

Before upgrading SQLite, make a copy of the database file.

Typical files include:

-   `server/db/production.sqlite`
-   `server/db/development.sqlite`
-   `server/db/test.sqlite`

## If You Previously Used Sequelize Commands

Replace old commands like these:

```bash
sequelize db:migrate
sequelize-cli db:migrate
yarn workspace ott-server run sequelize db:migrate
yarn workspace ott-server run sequelize-cli db:migrate
```

with:

```bash
yarn db:migrate
```

There is no supported `db:migrate:undo` replacement.

## How Existing Databases Are Handled

The first Drizzle-based migration run checks for old Sequelize-managed databases.

Expected behavior for an existing healthy installation:

-   the old `SequelizeMeta` table is detected
-   the schema is adopted into the new migration tracking table
-   later migrations continue under the new system

If your database was manually modified outside the normal migration flow, inspect it carefully before upgrading.

## Verification After Upgrade

After restarting OTT, verify:

-   the app starts without DB errors
-   you can load the homepage
-   users can log in
-   rooms can be created and loaded
-   existing permanent rooms still load correctly
-   cached video metadata still works normally

For PostgreSQL deployments, also verify logs do not show migration adoption or schema errors on every restart.

## Recommended Rollback Strategy

There is no migration undo command.

If the upgrade fails in production, the safest rollback is:

1. stop the upgraded app
2. restore the database backup
3. restore the previous app version
4. start the previous version

Do not assume you can safely downgrade by hand-editing migration state tables.

## Example Docker Compose Upgrade Flow

If you deploy with docker-compose, a safe pattern is:

```bash
docker compose pull
docker compose run --rm app yarn db:migrate
docker compose up -d
```

Adjust the service name if your application service is not named `app`.

## Troubleshooting

### Migration command fails immediately

Check:

-   `NODE_ENV`
-   `db.mode`
-   database credentials
-   whether the database server is reachable

### App starts but old data looks wrong

Check:

-   that you ran migrations against the correct database
-   that the correct production config file was loaded
-   that you did not accidentally point production at a fresh SQLite file

### Adoption from old Sequelize history fails

This usually means the existing database does not match the expected migration history.

Actions:

1. inspect the existing schema and migration tables
2. compare against your last known good release
3. restore from backup if necessary before retrying

## Command Summary

Production Postgres:

```bash
NODE_ENV=production yarn db:migrate
```

Production SQLite:

```bash
NODE_ENV=production DB_MODE=sqlite yarn db:migrate
```

Test environment:

```bash
NODE_ENV=test yarn db:migrate
```
