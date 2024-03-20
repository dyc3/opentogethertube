FROM nginx
COPY deploy/nginx.prod.conf /etc/nginx/conf.d/nginx.conf
