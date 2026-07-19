FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 monespaceprof \
    && useradd --uid 10001 --gid monespaceprof --create-home monespaceprof
WORKDIR /app

COPY backend/pyproject.toml ./pyproject.toml
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint

RUN pip install --upgrade pip && pip install . && chmod +x /usr/local/bin/backend-entrypoint

USER monespaceprof
EXPOSE 8000
ENTRYPOINT ["backend-entrypoint"]
