FROM node:22-bookworm-slim

WORKDIR /app

# Host boots the game via jsdom — keep it in production deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV MIND_VESSEL_CLOUD=1
ENV PORT=8080
ENV WORLD_PATH=/data/save.json

RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "scripts/start.js"]
