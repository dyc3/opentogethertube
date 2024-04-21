FROM nginx:alpine
COPY deploy/nginx.prod.conf /etc/nginx/conf.d/nginx.conf
