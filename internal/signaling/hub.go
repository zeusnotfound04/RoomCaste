package signaling

import (
	"sync"
)
  
type Hub struct {
	mu sync.RWMutex
	rooms  map[string]*Room
}


type Room struct {
	ID  string
	mu  sync.Mutex
	peers  map[string]*Connection
}
	

func NewHub() *Hub{
	return &Hub{
		rooms: make(map[string]*Room),
	}
}



func (h *Hub)  getOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer  h.mu.Unlock()
	if r, ok := h.rooms[roomID]; ok {
		return  r
	}

	r:= &Room{
		ID: roomID,
		peers: make(map[string]*Connection),
	}
	h.rooms[roomID] = r
	return  r
}



func (h  *Hub) removeRoomIfEmpty(roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r, ok := h.rooms[roomID]; ok {
		r.mu.Lock()
		empty := len(r.peers) == 0
		r.mu.Unlock()
		if empty {
			delete(h.rooms , roomID)
		}
	}
}


func (h *Hub) Join(roomID, peerID string, c *Connection) {
	room := h.getOrCreateRoom(roomID)
	room.mu.Lock()
	room.peers[peerID] = c
	room.mu.Unlock()
}


func (h *Hub) Leave(roomID, peerID string) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	room.mu.Lock()
	delete(room.peers, peerID)
	room.mu.Unlock()
	h.removeRoomIfEmpty(roomID)
}

func (h *Hub) Broadcast(roomID string, data []byte, excludePeerID string) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	for pid, c := range room.peers {
		if excludePeerID != "" && pid == excludePeerID {
			continue
		}
		c.Enqueue(data)
	}
}

func (h *Hub) SendTo(roomID, targetPeerID string, data []byte) {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	room.mu.Lock()
	c, ok := room.peers[targetPeerID]
	room.mu.Unlock()
	if ok {
		c.Enqueue(data)
	}
}


func (h *Hub) ListPeers(roomID string) []string {
	h.mu.RLock()
	room, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return nil
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	ids := make([]string, 0, len(room.peers))
	for id := range room.peers {
		ids = append(ids, id)
	}
	return ids
}