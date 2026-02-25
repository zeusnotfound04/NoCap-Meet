# NoCap Meet

Private video calling with WebRTC and Go WebSocket signaling server.

## Quick Start

```bash
./dev.sh
```

## Manual Start

Start Go server:
```bash
cd apps/server
go run main.go
```

Start Next.js frontend:
```bash
cd apps/web
pnpm dev
```

## Architecture

- Frontend: Next.js (apps/web)
- Signaling Server: Go WebSocket (apps/server)
- WebRTC: Peer-to-peer media streaming

## Join a Call

1. Open http://localhost:3000
2. Enter a room ID
3. Click "Join Room"
4. Share the room ID with others

