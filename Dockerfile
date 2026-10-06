FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json nuxt.config.ts ./
# nuxt.config.ts is copied first so the postinstall `nuxt prepare` sees devtools: false.
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ARG NIGHTLIGHT_UID=10001
ARG NIGHTLIGHT_GID=10001

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# ffprobe/ffmpeg read duration, thumbnails and waveform peaks of files linked from the server media folder.
RUN apk add --no-cache ffmpeg

RUN addgroup -S -g "${NIGHTLIGHT_GID}" nightlight \
  && adduser -S -D -H -u "${NIGHTLIGHT_UID}" -G nightlight nightlight \
  && mkdir -p /app/storage/uploads /app/storage/generated /app/storage/backups \
  && chown -R nightlight:nightlight /app/storage

COPY --from=build --chown=nightlight:nightlight /app/.output ./.output

USER nightlight
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
