# syntax=docker/dockerfile:1
FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY services/risk/pyproject.toml ./
RUN pip install --no-cache-dir ".[otel]"
COPY services/risk/app ./app
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
