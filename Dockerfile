# Real AI Gateway (LiteLLM Proxy) - hosted on Google Cloud Run for a
# public URL the deployed Next.js app (on Vercel) can reach, replacing the
# local-only http://localhost:4000 this app used during development.
# Render's free tier (512MB RAM) OOM-killed this same process at startup
# (LiteLLM's [proxy] extras pull in a genuinely heavy dependency set -
# boto3, azure SDKs, numpy, tokenizers - even though this app only uses 4
# simple providers); Cloud Run's free tier allows configuring real memory
# headroom per instance instead.
FROM python:3.12.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY litellm-config.yaml .

# Cloud Run injects $PORT at runtime and requires listening on 0.0.0.0.
CMD litellm --config litellm-config.yaml --port ${PORT:-8080} --host 0.0.0.0
