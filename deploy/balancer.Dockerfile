FROM rust:1-alpine3.18 as build-stage

WORKDIR /usr/app/

COPY . .

RUN apk add --no-cache musl-dev openssl-dev

RUN cargo build --release --bin ott-balancer-bin

FROM alpine:3.18 as production-stage

WORKDIR /usr/app/

COPY --from=build-stage /usr/app/target/release/ott-balancer-bin /usr/app/

CMD ["./ott-balancer-bin"]