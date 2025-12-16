# Backend Dockerfile
# Node.js 20 LTS - Alpine (hafif imaj)
FROM node:20-alpine AS builder

# Çalışma dizini
WORKDIR /app

# Paket dosyalarını kopyala
COPY package*.json ./

# Build için tüm bağımlılıkları yükle (devDependencies dahil - TypeScript için gerekli)
RUN npm ci && npm cache clean --force

# Kaynak kodları kopyala
COPY . .

# TypeScript derle
RUN npm run build

# Production için sadece production dependencies yükle
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine AS production

# Timezone ayarı
ENV TZ=Europe/Istanbul
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Europe/Istanbul /etc/localtime && \
    echo "Europe/Istanbul" > /etc/timezone

# Güvenlik: non-root kullanıcı oluştur
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Production bağımlılıklarını kopyala
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/healthcheck.js ./

# Kullanıcıyı değiştir
USER nodejs

# Port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node healthcheck.js || exit 1

# Başlat
CMD ["node", "dist/server.js"]
