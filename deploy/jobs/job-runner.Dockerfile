FROM alpine:latest
WORKDIR /app

RUN apk add --no-cache bash curl postgresql-client

# Latest releases available at https://github.com/aptible/supercronic/releases
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.25/supercronic-linux-amd64 \
	SUPERCRONIC=supercronic-linux-amd64 \
	SUPERCRONIC_SHA1SUM=642f4f5a2b67f3400b5ea71ff24f18c0a7d77d49

RUN curl -fsSLO "$SUPERCRONIC_URL" \
	&& echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
	&& chmod +x "$SUPERCRONIC" \
	&& mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
	&& ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

COPY deploy/jobs/backup_pg.sh .
COPY deploy/jobs/crontab crontab

ENTRYPOINT ["supercronic", "-prometheus-listen-address", "0.0.0.0", "/app/crontab"]
