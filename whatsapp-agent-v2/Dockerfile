FROM node:20-alpine

RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Jakarta

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p auth skills

RUN addgroup -g 1001 -S agent && adduser -S agent -u 1001 && chown -R agent:agent /app
USER agent

CMD ["node", "index.js"]
