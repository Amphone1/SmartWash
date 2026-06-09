# syntax=docker/dockerfile:1
FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY services/ocr/pyproject.toml ./
RUN pip install --no-cache-dir ".[otel]"
COPY services/ocr/app ./app
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
