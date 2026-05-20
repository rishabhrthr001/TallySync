FROM node:20-slim

WORKDIR /app

# Install dependencies needed for some node modules if any (bcrypt, etc)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the server listens on the correct port and host
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
