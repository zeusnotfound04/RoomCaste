package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/zeusnotfound04/roomcast/internal/signaling"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	hub := signaling.NewHub()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		if websocket.IsWebSocketUpgrade(r) {
			roomID := r.URL.Query().Get("room")
			peerID := r.URL.Query().Get("peer")
			if roomID == "" || peerID == "" {
				http.Error(w, "missing room or peer", http.StatusBadRequest)
				return
			}

			ws, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				log.Println("upgrade:", err)
				return
			}

			log.Printf("peer %s joined room %s", peerID, roomID)

			conn := signaling.NewConnection(ws, hub, roomID, peerID, func() {
				log.Printf("peer %s left room %s", peerID, roomID)
			})

			hub.Join(roomID, peerID, conn)
		} else {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("RoomCast WebSocket Server is running on port 8888\nUse ws://localhost:8888/ws?room={ROOM_ID}&peer={PEER_ID} for WebSocket connections"))
		}
	})

	log.Println("RoomCast signaling on :8888")
	log.Fatal(http.ListenAndServe(":8888", nil))
}
