FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install && python3 -m pip install --break-system-packages --no-cache-dir -r backend/requirements.txt && corepack pnpm run build

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
