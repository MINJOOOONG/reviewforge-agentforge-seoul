FROM pytorch/pytorch:2.4.1-cuda12.4-cudnn9-runtime

WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

ENV MODEL_PATH=/models/clip
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --retries=8 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
