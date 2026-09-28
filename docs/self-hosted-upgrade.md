# Self-hosted upgrade guide

This guide is for self-hosted operators upgrading OpenTogetherTube after the switch from Sequelize to Drizzle.

## What changed

OpenTogetherTube no longer uses Sequelize for database access or migrations.

One command replaces the old `sequelize` and `sequelize-cli` commands:

```bash
yarn db:migrate
```

The new migration runner:

-   supports PostgreSQL and SQLite
-   reads the normal OTT config, so your existing `env/*.toml` files and database environment variables (`DB_MODE`, `DATABASE_URL`, `POSTGRES_*`) keep working unchanged
-   tracks migrations in Drizzle's migration table, `drizzle.__drizzle_migrations` on PostgreSQL and `__drizzle_migrations` on SQLite
-   adopts databases that the old Sequelize migrations created, without touching your data

You don't need to change any configuration.

## Minimum version

Your database must already have all of the old Sequelize migrations applied. Any OTT release from v0.10.0 through v0.15.0 applied all of them, so if you have run one of those releases against your database, you can upgrade directly.

If you are on a release older than v0.10.0, upgrade to v0.15.0 first. Start it once so it runs its migrations, then upgrade to this release. Skipping that step makes the migration runner stop with this error, and OTT will not start:

```
Found SequelizeMeta with incomplete history. Run the legacy Sequelize migrations first or manually reconcile these missing entries: ...
```

The Sequelize migrations no longer ship with OTT, so v0.15.0 is the only way to apply them.

## Before you upgrade

1. Back up your database.
2. Back up your `env/*.toml` config files.
3. Check your current version against the [minimum version](#minimum-version).

## Upgrading with Docker Compose

The Docker image runs `yarn db:migrate` every time the container starts, before it starts OTT. You don't need to run migrations by hand.

If you use the `docker-compose.yml` in the repository root, which runs the published `dyc3/opentogethertube` image:

```bash
docker compose pull
docker compose up -d
```

If you use `docker/docker-compose.yml`, which builds the image from source:

```bash
git pull
docker compose -f docker/docker-compose.yml up -d --build
```

Then check that the migration succeeded:

```bash
docker logs opentogethertube 2>&1 | grep db/migrate
```

If the migration fails, the container exits before OTT starts. The same command shows the error.

## Upgrading without Docker

From the repository root:

```bash
git pull
corepack enable
yarn install --immutable
NODE_ENV=production yarn db:migrate
yarn build
NODE_ENV=production yarn start
```

Stop the running app before you run the migration, and start it again after the build.

For SQLite, add `DB_MODE=sqlite` to the migration command unless `db.mode = "sqlite"` is already set in your config:

```bash
NODE_ENV=production DB_MODE=sqlite yarn db:migrate
```

SQLite database files live in `server/db/`, named after the environment, for example `server/db/production.sqlite`. Copy that file before upgrading.

If you have scripts that call the old commands, replace them with `yarn db:migrate`:

```bash
sequelize db:migrate
sequelize-cli db:migrate
yarn workspace ott-server run sequelize db:migrate
yarn workspace ott-server run sequelize-cli db:migrate
```

`yarn db:migrate:undo` no longer exists.

## What the first migration run does

On the first run, the migration runner finds the old `SequelizeMeta` table, checks that every Sequelize migration was applied, and records the current schema as already applied. It does not change your tables or data. The log shows:

```
Existing Sequelize migration history detected, adopting current schema into Drizzle tracking
Database migrations complete
```

After that, the `SequelizeMeta` table is no longer used. OTT leaves it in place and ignores it.

Later runs only log `Database migrations complete`. If you see the adoption message on every restart, the runner is pointed at a different database than you expect.

If your database was modified by hand outside the normal migrations, compare its schema with `server/database/migrations/<postgres|sqlite>/0000_initial_schema.sql` before upgrading. The runner only checks migration history, not the actual schema.

## Verification after upgrade

After restarting OTT, check that:

-   the app starts without database errors
-   the homepage loads
-   users can log in
-   rooms can be created and loaded
-   existing permanent rooms still load
-   adding videos to a room still works

## Rollback

There is no migration undo command. If the upgrade fails:

1. stop the upgraded app
2. restore the database backup
3. start the previous app version

Do not edit the `__drizzle_migrations` or `SequelizeMeta` tables by hand.

## Troubleshooting

### Migration fails immediately

Check:

-   `NODE_ENV`
-   `db.mode` or `DB_MODE`
-   database credentials
-   that the database server is reachable

### "Found SequelizeMeta with incomplete history"

Your database is older than v0.10.0. See [Minimum version](#minimum-version).

### App starts but data is missing

Check:

-   that the migration ran against the correct database
-   that OTT loaded the correct config file for `NODE_ENV`
-   that production is not pointed at a new, empty SQLite file
