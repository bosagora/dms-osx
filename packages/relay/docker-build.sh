#!/bin/bash

TAG_NANE="$(git rev-parse --abbrev-ref HEAD)-$(git rev-parse --short=6 HEAD)"
echo "TAG_NANE=$TAG_NANE"

docker build -t bosagora/dms-relay:"$TAG_NANE" -f Dockerfile  .
docker push bosagora/dms-relay:"$TAG_NANE"
