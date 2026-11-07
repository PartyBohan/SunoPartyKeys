FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:portable
FROM node:24-slim
WORKDIR /app
COPY --from=build /app/dist-node ./dist-node
COPY --from=build /app/dist-web ./dist-web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 OCEAN_DATA_DIR=/data OCEAN_AUTH_MODE=suno
VOLUME /data
EXPOSE 8787
CMD ["node","dist-node/server.mjs"]
