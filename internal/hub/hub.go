package hub

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type WSHub struct {
	Clients    map[*websocket.Conn]bool
	Broadcast  chan []byte
	Register   chan *websocket.Conn
	Unregister chan *websocket.Conn
	Mu         sync.Mutex
}

var Hub = &WSHub{
	Broadcast:  make(chan []byte),
	Register:   make(chan *websocket.Conn),
	Unregister: make(chan *websocket.Conn),
	Clients:    make(map[*websocket.Conn]bool),
}

func (h *WSHub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Mu.Lock()
			h.Clients[client] = true
			h.Mu.Unlock()
		case client := <-h.Unregister:
			h.Mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				client.Close()
			}
			h.Mu.Unlock()
		case message := <-h.Broadcast:
			h.Mu.Lock()
			for client := range h.Clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("WS error: %v", err)
					client.Close()
					delete(h.Clients, client)
				}
			}
			h.Mu.Unlock()
		}
	}
}

func BroadcastMessage(topic string, payload interface{}) {
	msg := map[string]interface{}{
		"topic":   topic,
		"payload": payload,
	}
	data, err := json.Marshal(msg)
	if err == nil {
		Hub.Broadcast <- data
	}
}
