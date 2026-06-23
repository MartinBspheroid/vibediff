FROM golang:1.22-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git nodejs npm
COPY . .
RUN cd web && npm ci && npm run build
RUN CGO_ENABLED=0 go build -ldflags "-s -w" -o vibediff .

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY --from=builder /src /app
RUN rm -rf /app/web/node_modules /app/web/.npm /app/.task /app/test-results /app/playwright-report || true
COPY --from=builder /src/vibediff /usr/local/bin/vibediff
EXPOSE 8888
ENTRYPOINT ["/bin/sh", "-lc", "exec vibediff -host 0.0.0.0 -port ${PORT:-8888} -no-open"]
