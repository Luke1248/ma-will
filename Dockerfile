FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form so $PORT is expanded at runtime (hosts like Render/Fly set it).
CMD gunicorn app:app --bind 0.0.0.0:$PORT --workers 2
