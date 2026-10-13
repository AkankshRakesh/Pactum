# syntax=docker/dockerfile:1

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip install gunicorn

COPY . .

# Jenkins uses this target for Django tests.
FROM base AS test
ENV DJANGO_DEBUG=False
CMD ["python", "manage.py", "test"]

# Jenkins uses this target for deployment.
FROM base AS runtime

EXPOSE 8000

CMD ["python", "docker-entrypoint.py"]
