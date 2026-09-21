FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ARG NIGHTLIGHT_UID=10001
ARG NIGHTLIGHT_GID=10001

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -S -g "${NIGHTLIGHT_GID}" nightlight \
  && adduser -S -D -H -u "${NIGHTLIGHT_UID}" -G nightlight nightlight \
  && mkdir -p /app/storage/uploads /app/storage/generated /app/storage/backups \
  && chown -R nightlight:nightlight /app/storage

COPY --from=build --chown=nightlight:nightlight /app/.output ./.output

USER nightlight
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
