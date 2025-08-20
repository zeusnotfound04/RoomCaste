package roomcaste




type EventType string

const (
	EventJoin     EventType = "join"
	EventLeave    EventType = "leave"
	EventMessage  EventType = "offer"
	EventAnswer   EventType = "answer"
	EventCandidate EventType = "candidate"
)


type Event struct {
	Type    EventType   `json:"type"`
	Sender   string      `json:"sender"`
	RoomID   string      `json:"roomId,omitempty"`
	Payload interface{}   `json:"payload,omitempty"`
}


