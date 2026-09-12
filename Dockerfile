FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts eslint.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

# Replace the stock config: it sets `user nginx` and listens on 80, both of
# which fail when the process is UID 1172.
COPY nginx.conf /etc/nginx/nginx.conf
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

RUN chown -R 1172:1172 /usr/share/nginx/html

USER 1172:1172

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
