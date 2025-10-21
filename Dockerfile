# Use Node 22
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files separately to leverage caching
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of the application code
# This layer will rebuild only if your code changes
COPY . .

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install Chromium and required libraries in a single layer
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

# Default command
CMD ["node", "index.js"]
