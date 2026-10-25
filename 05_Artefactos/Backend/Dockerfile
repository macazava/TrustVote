FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home appuser

COPY --chown=appuser:appuser main.py .
COPY --chown=appuser:appuser app ./app

USER appuser

EXPOSE 8001

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${APP_PORT:-8001}"]
