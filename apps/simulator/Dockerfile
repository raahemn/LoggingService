FROM node:20-alpine

WORKDIR /usr/src/app

COPY ./simulator/package*.json ./
RUN npm install --include=dev

COPY ./simulator .

# Start the application
CMD ["npx", "ts-node", "index.ts"]