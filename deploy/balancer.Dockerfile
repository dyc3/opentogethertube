FROM rust:1-alpine3.18 as build-stage

WORKDIR /usr/app/

COPY . .

RUN apk add --no-cache musl-dev openssl-dev

RUN cargo build --release --bin ott-balancer-bin && mv ./target/release/ott-balancer-bin . && cargo clean

FROM alpine:3.18 as production-stage

WORKDIR /usr/app/

COPY --from=build-stage /usr/app/ott-balancer-bin /usr/app/

CMD ["./ott-balancer-bin"]