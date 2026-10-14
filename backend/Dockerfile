FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \\
    && apt-get install -y --no-install-recommends build-essential libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN python -m pip install --upgrade pip \\
    && pip install -r requirements.txt \\
    && pip install gunicorn

COPY . .

EXPOSE 8000

# Set DJANGO_WSGI_MODULE to the project's actual WSGI module if it is not config.wsgi.
CMD ["sh", "-c", "python manage.py migrate && gunicorn ${DJANGO_WSGI_MODULE:-config.wsgi}:application --bind 0.0.0.0:8000"]
