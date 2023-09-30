# Managing Postgres

## How to restore a backup

To a local database running in docker using this repo's `docker-compose.yml`:

1. Find the IP address of the postgres container
```bash
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' opentogethertube_postgres
```

2. Restore the backup
```bash
psql -h <IP address> -U opentogethertube -d postgres -f <backup file>
```

The default password for the docker image is `postgres`.

One liner:
```bash
psql -h $(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' opentogethertube_postgres) -U opentogethertube -d postgres -f <backup file>
```

## How to connect to the database on fly.io

1. Open a proxy to the database
```bash
fly proxy 5432 -a ott-db-prod
```
You should now be able to connect to the database on `localhost:5432` using the credentials found in `ott-prod`'s secrets for `DATABASE_URL`.

```bash
fly ssh console -a ott-prod
env | grep DATABASE_URL
```