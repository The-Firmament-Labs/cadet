FROM rust:1.94-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.toml
COPY rust rust

RUN cargo build --release -p starbridge-runner

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/starbridge-runner /usr/local/bin/starbridge-runner
COPY examples /app/examples

ENTRYPOINT ["starbridge-runner"]
