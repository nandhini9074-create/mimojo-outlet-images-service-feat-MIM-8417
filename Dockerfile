FROM node:24.13.0-alpine AS builder
ARG NPM_TOKEN

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build && ls -l
RUN npm prune --prod

FROM node:24.13.0-alpine

#Install curl
RUN apk update && apk add curl

WORKDIR /app
COPY --from=builder /app ./

# Create a group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chgrp -R appgroup * && chmod -R g+rw *
# Tell docker that all future commands should run as the appuser user
USER appuser
CMD ["npm", "run", "start:prod"]