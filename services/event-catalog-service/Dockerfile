# ============================================================
# Dockerfile – TickEnt Event Catalog Service
# Port nội bộ: 3002
# ============================================================
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY src/ ./src/

EXPOSE 3002

CMD ["npm", "start"]
