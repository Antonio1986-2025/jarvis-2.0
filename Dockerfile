# ── Base ──
FROM node:20-alpine

# Diretório de trabalho
WORKDIR /app

# Copia dependências primeiro (cache de layers)
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --omit=dev

# Copia o restante do código
COPY . .

# Porta exposta
EXPOSE 3000

# Inicia o JARVIS
CMD ["node", "src/index.js"]
