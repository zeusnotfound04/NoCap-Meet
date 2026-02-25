#!/bin/bash

echo "Starting NoCap Meet..."

echo "Starting Go WebSocket server..."
cd apps/server && ./dev.sh &
SERVER_PID=$!

sleep 2

echo "Starting Next.js frontend..."
cd apps/web && pnpm dev &
WEB_PID=$!

trap "kill $SERVER_PID $WEB_PID" EXIT

wait
