# ============================================================
# Dockerfile – TickEnt API Gateway
# Port nội bộ: 8080
# ============================================================
FROM node:18-alpine

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache.
# Layer npm install sẽ không bị rebuild nếu code thay đổi nhưng package.json không đổi.
COPY package*.json ./

# Chỉ cài production dependencies, bỏ qua devDependencies → image nhỏ hơn
RUN npm install --production

# Copy toàn bộ mã nguồn vào container
COPY src/ ./src/

# Expose cổng nội bộ của Gateway
EXPOSE 8080

# Lệnh khởi chạy mặc định
CMD ["npm", "start"]
