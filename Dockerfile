FROM node:22-slim

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy and build application
COPY . .
RUN npm run build

# Set up runtime
ENV NODE_ENV=production
ENV IN_MEMORIA_DB_PATH=/app/in-memoria.db

CMD ["node", "dist/index.js", "server"]
