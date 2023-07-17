FROM alpine:latest
WORKDIR /app

RUN apk add --no-cache bash curl postgresql-client

COPY deploy/jobs/backup_pg.sh .

ENTRYPOINT ["/app/backup_pg.sh"]
