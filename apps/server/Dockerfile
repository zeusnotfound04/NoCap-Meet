FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY apps/server/go.mod apps/server/go.sum ./
RUN go mod download

COPY apps/server/ ./

RUN CGO_ENABLED=0 GOOS=linux go build -o server .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 8080

CMD ["./server"]
