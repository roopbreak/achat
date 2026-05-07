FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

RUN apk del python3 make g++

COPY . .

VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/story-chat.db \
    DATA_DIR=/data

EXPOSE 3001
CMD ["node", "index.mjs"]
