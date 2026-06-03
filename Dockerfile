FROM nginx:alpine

COPY . /usr/share/nginx/html

# Override default nginx config to add GLB mime type properly
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
