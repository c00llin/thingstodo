# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
ARG COMMIT_SHA=unknown
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN COMMIT_SHA=${COMMIT_SHA} npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-build
ARG COMMIT_SHA=unknown
RUN apk add --no-cache jq
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-build /app/internal/frontend/dist /app/internal/frontend/dist
RUN APP_VERSION=$(jq -r .version frontend/package.json) && \
    SHORT_SHA=$(echo "${COMMIT_SHA}" | cut -c1-7) && \
    CGO_ENABLED=0 go build -ldflags="-s -w -X main.Version=${APP_VERSION} -X main.Commit=${SHORT_SHA}" -o /thingstodo ./cmd/server

# Stage 3: Runtime
FROM scratch
COPY --from=backend-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-build /etc/passwd /etc/passwd
COPY --from=backend-build /etc/group /etc/group
COPY --from=backend-build /thingstodo /thingstodo
USER nobody
EXPOSE 2999
ENTRYPOINT ["/thingstodo"]
