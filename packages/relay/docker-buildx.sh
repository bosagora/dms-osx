#!/bin/bash

TAG_NANE="$(git rev-parse --short=12 HEAD)"
echo "TAG_NANE=$TAG_NANE"

docker buildx build --platform=linux/amd64,linux/arm64 -t bosagora/kios-relay:"$TAG_NANE" -f Dockerfile --push ../../
docker buildx build --platform=linux/amd64,linux/arm64 -t bosagora/kios-relay:latest -f Dockerfile --push ../../
