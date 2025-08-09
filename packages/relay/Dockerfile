FROM node:18-alpine

RUN apk add --no-cache python3 g++ make yarn libc6-compat

RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app/

ADD ./packages/relay /app/
COPY ./packages/relay/env/.env.sample /app/env/.env
COPY ./yarn.lock /app/yarn.lock

RUN yarn install --frozen-lockfile || yarn install

RUN yarn run build

ENTRYPOINT [ "/app/docker/entrypoint.sh" ]
