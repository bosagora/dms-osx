FROM node:16-alpine

RUN apk add --update python3 g++ make
RUN alias python=python3

WORKDIR /app/

ADD . /app/
COPY ./env/.env.sample /app/env/.env

RUN npm install
RUN npm run build

ENTRYPOINT [ "/app/docker/entrypoint.sh" ]
