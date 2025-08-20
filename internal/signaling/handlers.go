package signaling

import (
	"encoding/json"
	"log"
)

func handleIncoming(c *Connection, data []byte) {
	var env Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		log.Printf("invalid json from peer=%s: %v", c.peerID, err)
		return
	}

	if env.From == "" {
		env.From = c.peerID
	}
	if env.RoomID == "" {
		env.RoomID = c.roomID
	}

	switch env.Type {
	case MsgJoin:
		ack := Envelope{
			Type:   MsgJoin,
			RoomID: c.roomID,
			From:   "server",
			Payload: mustJSON(map[string]any{
				"peers": c.hub.ListPeers(c.roomID),
			}),
		}
		c.Enqueue(mustMarshal(ack))

		notify := Envelope{
			Type:    "peer_joined",
			RoomID:  c.roomID,
			From:    c.peerID,
			Payload: json.RawMessage(`{}`),
		}
		c.hub.Broadcast(c.roomID, mustMarshal(notify), c.peerID)

	case MsgLeave:
		c.cleanup()

	case MsgMessage, MsgOffer, MsgAnswer, MsgCandidate:
		if env.To != "" {
			c.hub.SendTo(c.roomID, env.To, data)
		} else {
			c.hub.Broadcast(c.roomID, data, c.peerID)
		}

	case MsgPing:
		pong := Envelope{Type: MsgPong, RoomID: c.roomID, From: "server"}
		c.Enqueue(mustMarshal(pong))

	default:
		log.Printf("unknown msg type=%s from peer=%s", env.Type, c.peerID)
	}
}


func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func mustJSON(v any) json.RawMessage {
	b, _ := json.Marshal(v)
	return json.RawMessage(b)
}
