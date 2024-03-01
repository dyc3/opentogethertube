FROM rust:1-slim-buster as build-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y build-essential pkg-config openssl libssl-dev && rm -rf /var/lib/apt/lists/*
COPY . .
RUN cargo build --release --bin ott-collector && mv ./target/release/ott-collector . && cargo clean

FROM debian:buster-slim as production-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y openssl dnsutils curl && rm -rf /var/lib/apt/lists/*
ENV ROCKET_ADDRESS=0.0.0.0
RUN ulimit -c unlimited
COPY --from=build-stage /app/ott-collector /app/

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD ( curl -f http://localhost:8000/status || exit 1 )
CMD ["./ott-collector"]

FROM debian:buster-slim as deploy-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y openssl dnsutils curl && rm -rf /var/lib/apt/lists/*
ENV ROCKET_ADDRESS=0.0.0.0
RUN ulimit -c unlimited
COPY --from=build-stage /app/ott-collector /app/
ARG DEPLOY_TARGET
COPY deploy/$DEPLOY_TARGET.toml /app/collector.toml

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD ( curl -f http://localhost:8000/status || exit 1 )
CMD ["./ott-collector"]
