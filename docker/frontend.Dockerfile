FROM nginx:1.27-alpine

COPY docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY assets /usr/share/nginx/html/assets
COPY uploads /usr/share/nginx/html/uploads

EXPOSE 8080

