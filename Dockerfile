FROM node:alpine
MAINTAINER Naoto Yamaguchi "contact@naotoyamaguchi.com"

COPY package.json /srv/

RUN apk add --update \
    python \
    python-dev \
    py-pip \
    build-base \
  && pip install virtualenv

RUN apk --no-cache add --virtual builds-deps build-base

RUN cd /srv && npm install --build-from-source=bcrypt && npm install --production

RUN apk del builds-deps && rm -rf /var/cache/apk/*

COPY server.js /srv/
COPY knexfile.js /srv/
COPY migrations /srv/migrations

ENV PORT=3000
ENV PRIVATE_KEY=XXXXXXXXXX
ENV AWS_ACCESS_KEY_ID=XXXXXXXXXXXXXXXXXXX
ENV AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
ENV AWS_REGION=XX-XXXX-X
ENV NODE_ENV=production

WORKDIR /srv 

CMD ["npm", "start"]