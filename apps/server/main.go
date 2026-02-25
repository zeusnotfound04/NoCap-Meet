package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	ID     string
	RoomID string
	Conn   *websocket.Conn
	Hub    *Hub
}

type Hub struct {
	Clients    map[string]*Client
	Rooms      map[string]map[string]*Client
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *Message
	mu         sync.RWMutex
}

type Message struct {
	Type    string          `json:"type"`
	From    string          `json:"from"`
	To      string          `json:"to,omitempty"`
	RoomID  string          `json:"roomId,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func NewHub() *Hub {
	return &Hub{
		Clients:    make(map[string]*Client),
		Rooms:      make(map[string]map[string]*Client),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan *Message, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client.ID] = client
			if client.RoomID != "" {
				if h.Rooms[client.RoomID] == nil {
					h.Rooms[client.RoomID] = make(map[string]*Client)
				}
				h.Rooms[client.RoomID][client.ID] = client

				for _, c := range h.Rooms[client.RoomID] {
					if c.ID != client.ID {
						msg := Message{
							Type:   "user-joined",
							From:   client.ID,
							RoomID: client.RoomID,
						}
						data, _ := json.Marshal(msg)
						c.Conn.WriteMessage(websocket.TextMessage, data)
					}
				}
			}
			h.mu.Unlock()

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client.ID]; ok {
				delete(h.Clients, client.ID)
				if client.RoomID != "" {
					if room, exists := h.Rooms[client.RoomID]; exists {
						delete(room, client.ID)
						if len(room) == 0 {
							delete(h.Rooms, client.RoomID)
						} else {
							for _, c := range room {
								msg := Message{
									Type:   "user-left",
									From:   client.ID,
									RoomID: client.RoomID,
								}
								data, _ := json.Marshal(msg)
								c.Conn.WriteMessage(websocket.TextMessage, data)
							}
						}
					}
				}
				client.Conn.Close()
			}
			h.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			if msg.To != "" {
				if client, ok := h.Clients[msg.To]; ok {
					data, _ := json.Marshal(msg)
					client.Conn.WriteMessage(websocket.TextMessage, data)
				}
			} else if msg.RoomID != "" {
				if room, ok := h.Rooms[msg.RoomID]; ok {
					for _, client := range room {
						if client.ID != msg.From {
							data, _ := json.Marshal(msg)
							client.Conn.WriteMessage(websocket.TextMessage, data)
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		log.Printf("[WS] Client %s disconnecting", c.ID)
		c.Hub.Unregister <- c
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] Read error for client %s: %v", c.ID, err)
			}
			break
		}

		log.Printf("[WS] Received message from client %s: %s", c.ID, string(message))

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("[WS] Failed to unmarshal message: %v", err)
			continue
		}

		msg.From = c.ID
		c.Hub.Broadcast <- &msg
	}
}

var hub *Hub

func main() {
	godotenv.Load()

	hub = NewHub()
	go hub.Run()

	http.HandleFunc("/ws", handleWebSocket)
	http.HandleFunc("/health", handleHealth)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, corsMiddleware(http.DefaultServeMux)); err != nil {
		log.Fatal(err)
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	log.Printf("[WS] New connection request from %s", r.RemoteAddr)
	log.Printf("[WS] Room ID: %s", r.URL.Query().Get("roomId"))

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}

	clientID := uuid.New().String()
	roomID := r.URL.Query().Get("roomId")

	log.Printf("[WS] Client %s joined room %s", clientID, roomID)

	client := &Client{
		ID:     clientID,
		RoomID: roomID,
		Conn:   conn,
		Hub:    hub,
	}

	hub.Register <- client

	msg := Message{
		Type:    "connected",
		From:    "server",
		To:      clientID,
		Payload: json.RawMessage(`{"clientId":"` + clientID + `"}`),
	}
	data, _ := json.Marshal(msg)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		log.Printf("[WS] Failed to send connected message: %v", err)
		return
	}

	log.Printf("[WS] Sent connected message to client %s", clientID)

	go client.ReadPump()
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
