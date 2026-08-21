# Standalone Workers — Running workers

### Development (tsx, no build step)

```sh
cd workers/send-invoice
npm install
npm start          # runs: tsx index.ts
```

### Production (compiled JS)

```sh
cd workers/send-invoice
npm install
npm run build      # runs: tsc
npm run start:prod # runs: node dist/index.js
```

### All workers at once

```sh
casen worker start
```

To start a specific worker:

```sh
casen worker start send-invoice
```


## Docker

Each scaffolded worker includes a multi-stage `Dockerfile` recipe in its README:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.ts tsconfig.json ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
```

Build and run:

```sh
docker build -t my-org/send-invoice .
docker run -e ZEEBE_ADDRESS=http://reebe:26500 my-org/send-invoice
```

---
Source: https://docs.bpmnkit.com/guides/workers-standalone/
