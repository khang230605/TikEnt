# ============================================================
# Dockerfile – TickEnt Booking Service
# Port nội bộ: 3001
# Dùng chung cho 3 container:
#   - booking-api      → CMD ["npm", "start"]
#   - booking-worker   → CMD ["npm", "run", "consumer"]
#   - timeout-worker   → CMD ["npm", "run", "consumer:timeout"]
# Override CMD trong docker-compose.yml cho từng container.
# ============================================================
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY src/ ./src/

# Cổng nội bộ của Booking API (chỉ booking-api dùng, worker không expose port)
EXPOSE 3001

CMD ["npm", "start"]
