FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -S nightlight && adduser -S nightlight -G nightlight

COPY --from=build --chown=nightlight:nightlight /app/.output ./.output

USER nightlight
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
