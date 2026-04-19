# [claude-code 2026-04-19] Production image for hermes-sidecar.
# uv-based — never pip/venv. Multi-stage so wheels build separately from runtime layer.
FROM ghcr.io/astral-sh/uv:0.4-python3.11-bookworm-slim AS builder

WORKDIR /app

COPY pyproject.toml README.md ./
COPY hermes_sidecar ./hermes_sidecar

RUN uv sync --no-dev --frozen || uv sync --no-dev

FROM python:3.11-slim-bookworm AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app /app
COPY config.yaml ./config.yaml
COPY entrypoint.py ./entrypoint.py

ENV PATH="/app/.venv/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8318

EXPOSE 8318

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/healthz" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "entrypoint.py"]
