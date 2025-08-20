package signaling

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type Connection struct {
	ws *websocket.Conn
	sendCh  chan []byte
	hub    *Hub
	peerID   string
	roomID   string
	closeCh   chan struct{}
	onClose   func()
}


func NewConnection(ws *websocket.Conn, hub *Hub , roomID , peerID string, onClose  func()) *Connection{
	c := &Connection{
		ws : ws,
		hub: hub,
		roomID: roomID,
		peerID: peerID,
		sendCh: make(chan []byte , 256),
		closeCh: make(chan struct{}),
		onClose: onClose,
	}
	go c.writePump()
	go c.readPump()
	return c
} 


func (c *Connection) Enqueue(data []byte) {
	select {
	case c.sendCh <- data:
	default :
		log.Printf("send buffer full for peer=%s room=%s; dropping message"  , c.peerID , c.roomID)
	}
}

func (c *Connection) readPump()  {
	defer c.cleanup()
	
	c.ws.SetReadLimit(1 << 20)
	_ = c.ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.ws.SetPongHandler(func(appData string) error {
		_= c.ws.SetReadDeadline(time.Now().Add(60 *time.Second))
		return nil
	})

	for {
		_, data , err := c.ws.ReadMessage()
		if err != nil {
			return
		}
		handleIncoming(c , data)
	}
}


func (c *Connection) writePump() {
	ticker := time.NewTicker(25 *time.Second)
	defer func ()  {
		ticker.Stop()
		c.cleanup()
	}()

	for {
		select {
		case data , ok := <-c.sendCh:
			_ = c.ws.SetWriteDeadline(time.Now().Add(10 *time.Second))
			if !ok {
				_ = c.ws.WriteMessage(websocket.CloseMessage, []byte{})
				return	
			}
			if err := c.ws.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.ws.SetWriteDeadline(time.Now().Add(10 *time.Second))
			if err := c.ws.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-c.closeCh:
			return
		}
	}
}


func (c *Connection) cleanup() {
	select {
	case <-c.closeCh:

	default : 
		close(c.closeCh)
	}
	c.hub.Leave(c.roomID , c.peerID)
	if c.onClose != nil {
		c.onClose()
	}
	_ = c.ws.Close()
}

