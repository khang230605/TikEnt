# ============================================================
# Dockerfile – TickEnt User Payment Service
# Port nội bộ: 3003
# Dùng chung cho 2 container:
#   - user-payment-api         → CMD ["npm", "start"]
#   - notification-worker      → CMD ["npm", "run", "consumer:notification"]
# Override CMD trong docker-compose.yml cho notification-worker.
# ============================================================
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY src/ ./src/

EXPOSE 3003

CMD ["npm", "start"]
