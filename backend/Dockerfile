FROM node:20-slim

WORKDIR /app

# Install dependencies needed for node modules and OCR image-to-PDF conversions (ImageMagick/Ghostscript)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    imagemagick \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Relax ImageMagick security policy for PDF conversion
RUN if [ -f /etc/ImageMagick-6/policy.xml ]; then \
        sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' /etc/ImageMagick-6/policy.xml; \
    fi && \
    if [ -f /etc/ImageMagick-7/policy.xml ]; then \
        sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' /etc/ImageMagick-7/policy.xml; \
    fi && \
    if [ -f /etc/ImageMagick/policy.xml ]; then \
        sed -i 's/rights="none" pattern="PDF"/rights="read|write" pattern="PDF"/g' /etc/ImageMagick/policy.xml; \
    fi

COPY package*.json ./

RUN npm install

COPY . .

# Ensure the server listens on the correct port and host
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
