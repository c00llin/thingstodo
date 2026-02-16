# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-build /app/frontend/dist /app/internal/frontend/dist
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /thingstodo ./cmd/server

# Stage 3: Runtime
FROM scratch
COPY --from=backend-build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-build /thingstodo /thingstodo
EXPOSE 2999
ENTRYPOINT ["/thingstodo"]
