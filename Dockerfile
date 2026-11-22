FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Persistent SQLite location separated from prisma/schema.prisma
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/prisma/data/dev.db"
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .

RUN chmod +x /app/scripts/docker-entrypoint.sh && mkdir -p /app/prisma/data
RUN npm run build

EXPOSE 3000

VOLUME ["/app/prisma/data"]

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
