package roomcaste

import "github.com/pion/webrtc/v4"

type Config struct {
	SignalingURL string
	ICEServers   []webrtc.ICEServer
}



func DefaultConfig()  Config {
	return Config{
		SignalingURL:  "ws://localhost:8080/ws",
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{
					"stun:stun.l.google.com:19302",
				},
			},
		},
	}
}