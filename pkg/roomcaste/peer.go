package roomcaste

import (
	"fmt"
	"sync"

	"github.com/pion/webrtc/v4"
)

type Peer struct {
	ID  string
	Conn   *webrtc.PeerConnection
	mu     sync.Mutex
}


func NewPeer(id string, config   webrtc.Configuration)  (*Peer , error)  {

	pc , err := webrtc.NewPeerConnection(config)
	if err != nil {
		return  nil , fmt.Errorf("failed to create a peer connection %w" , err)		
	}

	return &Peer{
		ID: id,
		Conn: pc,
	}, nil
}


func (p *Peer) Close()  error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.Conn != nil {
		return p.Conn.Close()
	}
	return nil
}


