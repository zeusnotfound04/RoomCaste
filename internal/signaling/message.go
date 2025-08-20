package signaling

import "encoding/json"

type MsgType string

const (
	MsgJoin      MsgType = "join"
	MsgLeave     MsgType = "leave"
	MsgMessage   MsgType = "message"
	MsgOffer     MsgType = "offer"
	MsgAnswer    MsgType = "answer"
	MsgCandidate MsgType = "candidate"
	MsgPing      MsgType = "ping"
	MsgPong      MsgType = "pong"
)

type Envelope struct {
	Type    MsgType         `json:"type"`
	RoomID  string          `json:"roomId,omitempty"`
	From    string          `json:"from,omitempty"`
	To      string          `json:"to,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`

	// Legacy fields for backwards compatibility
	Room      string          `json:"room,omitempty"`
	Offer     json.RawMessage `json:"offer,omitempty"`
	Answer    json.RawMessage `json:"answer,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
}
