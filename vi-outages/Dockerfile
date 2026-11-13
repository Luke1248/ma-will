FROM python:3.12-slim
# poppler-utils provides pdftotext, used to read WAPA's rotation schedule PDF.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server ./server
COPY web ./web
ENV PYTHONUNBUFFERED=1 PORT=8080 DB_PATH=/data/vi-outages.db
VOLUME /data
EXPOSE 8080
CMD ["python3", "server/app.py"]
