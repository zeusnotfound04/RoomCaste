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

	// Handle legacy room field
	if env.Room != "" && env.RoomID == "" {
		env.RoomID = env.Room
	}

	log.Printf("Handling message type=%s from peer=%s in room=%s", env.Type, c.peerID, env.RoomID)

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

	case MsgOffer:
		// Handle both payload format and direct offer field
		var offerData json.RawMessage
		if env.Payload != nil {
			offerData = env.Payload
		} else if env.Offer != nil {
			offerData = env.Offer
		}

		if offerData != nil {
			response := Envelope{
				Type:    MsgOffer,
				RoomID:  env.RoomID,
				From:    env.From,
				To:      env.To,
				Payload: offerData,
			}
			if env.To != "" {
				c.hub.SendTo(c.roomID, env.To, mustMarshal(response))
			} else {
				c.hub.Broadcast(c.roomID, mustMarshal(response), c.peerID)
			}
		}

	case MsgAnswer:
		// Handle both payload format and direct answer field
		var answerData json.RawMessage
		if env.Payload != nil {
			answerData = env.Payload
		} else if env.Answer != nil {
			answerData = env.Answer
		}

		if answerData != nil {
			response := Envelope{
				Type:    MsgAnswer,
				RoomID:  env.RoomID,
				From:    env.From,
				To:      env.To,
				Payload: answerData,
			}
			if env.To != "" {
				c.hub.SendTo(c.roomID, env.To, mustMarshal(response))
			} else {
				c.hub.Broadcast(c.roomID, mustMarshal(response), c.peerID)
			}
		}

	case MsgCandidate:
		// Handle both payload format and direct candidate field
		var candidateData json.RawMessage
		if env.Payload != nil {
			candidateData = env.Payload
		} else if env.Candidate != nil {
			candidateData = env.Candidate
		}

		if candidateData != nil {
			response := Envelope{
				Type:    MsgCandidate,
				RoomID:  env.RoomID,
				From:    env.From,
				To:      env.To,
				Payload: candidateData,
			}
			if env.To != "" {
				c.hub.SendTo(c.roomID, env.To, mustMarshal(response))
			} else {
				c.hub.Broadcast(c.roomID, mustMarshal(response), c.peerID)
			}
		}

	case MsgMessage:
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
