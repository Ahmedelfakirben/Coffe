# ============================================
# DOCKERFILE PARA COOLIFY - COFFEE SHOP APP
# ============================================

# Etapa 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente (excluye supabase/functions por .dockerignore)
COPY . .

# Build de la aplicación
RUN npm run build

# Etapa 2: Producción
FROM node:18-alpine AS production

WORKDIR /app

# Instalar solo serve para servir archivos estáticos
RUN npm install -g serve

# Copiar build desde etapa anterior
COPY --from=builder /app/dist ./dist

# Exponer puerto
EXPOSE 3000

# Comando para servir la aplicación
CMD ["serve", "-s", "dist", "-l", "3000"]
