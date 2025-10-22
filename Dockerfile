# Use Node 22
FROM node:22-slim

# Install Chromium and deps FIRST (cached across code changes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    lsb-release \
    xdg-utils \
    wget \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer env
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps (cached if package*.json unchanged)
COPY package*.json ./
RUN npm install --omit=dev

# Copy app code (only this layer changes on edits)
COPY . .

EXPOSE 8080
CMD ["node", "index.js"]