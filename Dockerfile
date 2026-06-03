FROM nginx:alpine

COPY . /usr/share/nginx/html

# Ensure proper MIME types for GLB and audio
RUN echo "model/gltf-binary glb;" >> /etc/nginx/mime.types && \
    echo "audio/mpeg mp3;" >> /etc/nginx/mime.types

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
