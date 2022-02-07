FROM node:14.17.3-alpine3.11

WORKDIR /usr/src/app

COPY ["*.json", "yarn.lock", "./"]

RUN yarn

COPY . .
RUN yarn build

EXPOSE 3000
EXPOSE 9082
CMD [ "./build/bin/www" ]

