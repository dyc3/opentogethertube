FROM rust:1-slim-buster as build-stage

WORKDIR /usr/app/

COPY . .

RUN apt-get update && apt-get install -y build-essential pkg-config openssl libssl-dev && rm -rf /var/lib/apt/lists/*

RUN cargo build --release --bin ott-balancer-bin && mv ./target/release/ott-balancer-bin . && cargo clean

FROM debian:buster-slim as production-stage

WORKDIR /usr/app/

COPY --from=build-stage /usr/app/ott-balancer-bin /usr/app/

RUN apt-get update && apt-get install -y openssl dnsutils && rm -rf /var/lib/apt/lists/*

RUN ulimit -c unlimited

ARG DEPLOY_TARGET
COPY deploy/$DEPLOY_TARGET.toml /usr/app/balancer.toml

CMD ["./ott-balancer-bin"]