package roomcaste

import (
	"encoding/json"
	"fmt"
	"sync"
)

type Room struct {
	ID       string
	client   *Client
	handlers map[string]func(peerID, msg string)
	mu       sync.RWMutex
}


type RoomMessage struct {
	Type    string    `json:"type"`
	RoomID  string     `json:"room_id"`
	PeerID   string     `json:"peer_id"`
	Payload   string     `json:"payload"`
}



func (c *Client)  JoinRoom(roomID string)   (*Room, error)  {
	room := &Room{
		ID:  roomID,
		client: c,
		handlers:  make(map[string]func(peerID string, msg string)),
	}
	msg := RoomMessage{
		Type: "join-room",
		RoomID: roomID,
		PeerID: c.ID,
	}
	if err := c.Send(msg); err != nil {
		return nil, err
	}
	c.OnMessage(func(raw []byte)  {
		var m RoomMessage
		if err := json.Unmarshal(raw, &m); err != nil {
			return 
		}
		if m.RoomID != roomID {
			return 
		}
		room.mu.RLock()
	})

	return room, nil
}


func (r *Room) Broadcast(payload string) error{
	msg := RoomMessage{
		Type: "room_message",
		RoomID: r.ID,
		PeerID: r.client.ID,
		Payload: payload,
	}
	return r.client.Send(msg)
}


func (r *Room) RemoveHandler(handlerID string){
	r.mu.Unlock()
	delete(r.handlers, handlerID)
}


func (r *Room) Leave() error{
	msg := RoomMessage{
		Type: "leave_room",
		RoomID: r.ID,
		PeerID: r.client.ID,
	}

	if err := r.client.Send(msg); err != nil {
		return err
	}
	fmt.Printf("Client %s left room %s\n" , r.client.ID , r.ID)
	return nil
}