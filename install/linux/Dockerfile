# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM oven/bun:1 AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# ==========================================
# Stage 2: Build Backend
# ==========================================
FROM rust:1.78 AS backend-builder

WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock* ./
COPY backend/src ./src

RUN cargo build --release

# ==========================================
# Stage 3: Runtime
# ==========================================
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -m -d /home/kweebec -s /bin/bash kweebec

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /app/backend/target/release/kweebec ./kweebec

# Copy frontend static files
COPY --from=frontend-builder /app/frontend/dist ./static

# Create data directories
RUN mkdir -p /data /servers /backups && \
    chown -R kweebec:kweebec /app /data /servers /backups

USER kweebec

# Environment
ENV HOST=0.0.0.0
ENV PORT=8443
ENV DATABASE_URL=sqlite:/data/kweebec.db?mode=rwc
ENV SERVERS_DIR=/servers
ENV BACKUPS_DIR=/backups
ENV RUST_LOG=info

EXPOSE 8443

CMD ["./kweebec"]
