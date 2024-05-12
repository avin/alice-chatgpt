FROM node:21-alpine

WORKDIR /usr/src/app
RUN chown node:node ./
USER node

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
COPY ./src ./src

EXPOSE 3000

CMD [ "npm", "start" ]