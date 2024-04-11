FROM rust:1-slim-buster as build-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y build-essential pkg-config openssl libssl-dev && rm -rf /var/lib/apt/lists/*
COPY . .
RUN cargo build --release --bin ott-balancer-bin && mv ./target/release/ott-balancer-bin . && cargo clean

FROM debian:buster-slim as production-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y openssl dnsutils && rm -rf /var/lib/apt/lists/*
RUN ulimit -c unlimited
COPY --from=build-stage /app/ott-balancer-bin /app/

CMD ["./ott-balancer-bin", "--config-path", "/app/env/balancer.toml"]

FROM debian:buster-slim as deploy-stage

WORKDIR /app/
RUN apt-get update && apt-get install -y openssl dnsutils && rm -rf /var/lib/apt/lists/*
RUN ulimit -c unlimited
COPY --from=build-stage /app/ott-balancer-bin /app/

ARG DEPLOY_TARGET
COPY deploy/$DEPLOY_TARGET.toml /app/balancer.toml

CMD ["./ott-balancer-bin"]
