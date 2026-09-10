FROM node:22-slim

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY backend/requirements.txt ./backend/requirements.txt
RUN corepack enable && corepack pnpm install --frozen-lockfile

# Use compact CPU wheels; the default PyPI torch package can pull large CUDA runtimes.
RUN python3 -m pip install --break-system-packages --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
  && python3 -m pip install --break-system-packages --no-cache-dir -r /app/backend/requirements.txt

COPY . .
RUN corepack pnpm run build

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
